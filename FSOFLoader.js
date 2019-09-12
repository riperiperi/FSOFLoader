THREE.FSOFLoader = (function() {

    function FSOFLoader(manager) {
        THREE.Loader.call(this, manager);
    }

    FSOFLoader.prototype = Object.assign(Object.create(THREE.Loader.prototype), {
        constructor: FSOFLoader,

        load: function (url, onLoad, onProgress, onError) {
            var self = this;
            var path = (self.path === '') ? THREE.LoaderUtils.extractUrlBase(url) : self.path;
            var loader = new THREE.FileLoader( this.manager );
            loader.setPath(self.path);
            loader.setResponseType('arraybuffer');
            loader.load(url, function (buffer) {
                try {
                    onLoad(self.parse(buffer, path));
                } catch (error) {
                    setTimeout(function () {
                        if (onError) onError(error);
                        self.manager.itemError(url);
                    }, 0);
                }
            }, onProgress, onError);
        },

        parse: function(buffer, path) {
            return new FSOF().read(buffer).asModel();
        }
    });

    function FSOF() {}
    FSOF.prototype = {
        constructor: FSOF,

        read: function(buffer) {
            var self = this;
            var view = new DataView(buffer);
            var offset = 0;

            this.magic = "";
            this.version = view.getInt32(offset+4, true);
            this.compressed = view.getUint8(offset+8);

            offset += 9;
            //if compressed, decompress the remainder of the buffer
            if (this.compressed > 0) {
                var inflate = new Zlib.Gunzip(new Uint8Array(buffer.slice(offset)));
                buffer = inflate.decompress().buffer;
                view = new DataView(buffer);
                offset = 0;
            }

            this.texCompressionType = view.getInt32(offset, true);
            this.floorWidth = view.getInt32(offset+4, true);
            this.floorHeight = view.getInt32(offset+8, true);
            this.wallWidth = view.getInt32(offset+12, true);
            this.wallHeight = view.getInt32(offset+16, true);
            this.hasNight = view.getUint8(offset+20);

            var floorTexSize = view.getInt32(offset+21, true);
            offset += 25;
            this.floorTexData = buffer.slice(offset, offset + floorTexSize);
            offset += floorTexSize;
            var wallTexSize = view.getInt32(offset, true);
            offset += 4;
            this.wallTexData = buffer.slice(offset, offset + wallTexSize);
            offset += wallTexSize;

            if (this.hasNight) {
                floorTexSize = view.getInt32(offset, true);
                offset += 4;
                this.nightFloorTexData = buffer.slice(offset, offset + floorTexSize);
                offset += floorTexSize;

                wallTexSize = view.getInt32(offset, true);
                offset += 4;
                this.nightWallTexData = buffer.slice(offset, offset + wallTexSize);
                offset += wallTexSize;

                this.nightLightColor = "#"+view.getUint32(offset, true).toString(16);
                offset += 4;
            }

            function readVerts() {
                var result = {};

                var vertCount = view.getInt32(offset, true);
                offset += 4;
                var verts = [];
                for (var i = 0; i < vertCount; i++) {
                    //position, texcoord, normal (3, 2, 3)
                    verts.push({
                        pos: [
                            view.getFloat32(offset, true),
                            view.getFloat32(offset+4, true),
                            view.getFloat32(offset+8, true)
                            ],
                        texC: [
                            view.getFloat32(offset+12, true),
                            view.getFloat32(offset+16, true)
                            ],
                        normal: [
                            view.getFloat32(offset+20, true),
                            view.getFloat32(offset+24, true),
                            view.getFloat32(offset+28, true)
                        ]});
                    offset += 32;
                }
                result.vertices = verts;

                var indCount = view.getInt32(offset, true);
                offset += 4;
                result.indices = new Uint32Array(buffer.slice(offset, indCount*4+offset));
                offset += indCount * 4;
                return result;
            }

            this.floor = readVerts();
            this.wall = readVerts();
            return this;
        },

        asModel: function() {
            var self = this;
            function toGeometry(geom, texture) {
                var verts = geom.vertices;
                var inds = geom.indices;
                var vbuf = new Float32Array(verts.length * 3);
                var tbuf = new Float32Array(verts.length * 2);
                var nbuf = new Float32Array(verts.length * 3);
                var voff = 0;
                var toff = 0;
                var noff = 0;
                for (var i = 0; i < verts.length; i++) {
                    var vert = verts[i];
                    if (isNaN(vert.normal[0])) {
                        vert.normal = [0, 1, 0];
                    }
                    vbuf[voff++] = vert.pos[0];
                    vbuf[voff++] = vert.pos[1];
                    vbuf[voff++] = vert.pos[2];
                    tbuf[toff++] = vert.texC[0];
                    tbuf[toff++] = vert.texC[1];
                    nbuf[noff++] = vert.normal[0];
                    nbuf[noff++] = vert.normal[1];
                    nbuf[noff++] = vert.normal[2];
                }
                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute('position', new THREE.BufferAttribute(vbuf, 3));
                geometry.addAttribute('uv', new THREE.BufferAttribute(tbuf, 2));
                geometry.addAttribute('normal', new THREE.BufferAttribute(nbuf, 3));
                geometry.setIndex(new THREE.BufferAttribute(inds, 1));
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();
                
                //create the material
                var material = new THREE.MeshPhysicalMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 });
                var customDepthMaterial = new THREE.MeshDepthMaterial({
                    depthPacking: THREE.RGBADepthPacking,
                    map: texture,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide
                });

                var mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.customDepthMaterial = customDepthMaterial;
                return mesh;
            };

            function loadTex(data, width, height) {
                var FORMATS = {
                    COMPRESSED_RGB_S3TC_DXT1_EXT: 0x83F0,
                    COMPRESSED_RGBA_S3TC_DXT1_EXT: 0x83F1,
                    COMPRESSED_RGBA_S3TC_DXT3_EXT: 0x83F2,
                    COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83F3,
                };

                var texture = new THREE.CompressedTexture([{data: new Uint8Array(data), width: width, height: height}], width, height, FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                texture.needsUpdate = true;
                return texture;
            }

            var group = new THREE.Group();
            group.add(toGeometry(this.wall, loadTex(this.wallTexData, this.wallWidth, this.wallHeight)));
            group.add(toGeometry(this.floor, loadTex(this.floorTexData, this.floorWidth, this.floorHeight)));

            return group;
        }
    };

    return FSOFLoader;
})();