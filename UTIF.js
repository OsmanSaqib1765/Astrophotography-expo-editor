// minimal UTIF for 8-bit RGB/8-bit RGBA TIFFs
var UTIF8 = {
  decode: function(buf) {
    var dv = new DataView(buf);
    var LE = dv.getUint16(0,true)==0x4949;
    if(dv.getUint16(2,LE)!=42) throw "Invalid TIFF";

    var offset = dv.getUint32(4,LE);
    var ifds = [];

    while(offset) {
      var num = dv.getUint16(offset,LE);
      var ifd = {};
      for(var i=0;i<num;i++){
        var t = offset+2+i*12;
        var tag = dv.getUint16(t,LE);
        var type = dv.getUint16(t+2,LE);
        var count = dv.getUint32(t+4,LE);
        var val = dv.getUint32(t+8,LE);
        ifd[tag] = val;
      }
      ifds.push(ifd);
      offset = dv.getUint32(offset+2+12*num,LE);
    }
    return ifds;
  },

  decodeImage: function(buf, ifd) {
    var dv = new DataView(buf);
    var offset = ifd[273]; // StripOffset
    var width = ifd[256];
    var height = ifd[257];
    var samples = ifd[277] || 3; // SamplesPerPixel
    var arr = new Uint8Array(width*height*4);
    var i,j;
    for(i=0;i<width*height;i++){
      for(j=0;j<samples;j++){
        arr[i*4+j] = dv.getUint8(offset+i*samples+j);
      }
      if(samples<4) arr[i*4+3]=255;
    }
    ifd.Image = arr;
    ifd.width = width;
    ifd.height = height;
  },

  toRGBA8: function(ifd){ return ifd.Image; }
};
