module.exports=[737678,a=>{"use strict";var b=a.i(62820),c=a.i(439448),d=a.i(555460),e=a.i(403139),f=a.i(115809),g=a.i(544017),h=a.i(557474),i=e.f.packet,j=class{constructor(){this.packet=[],this.setAccTitle=e.b,this.getAccTitle=e.c,this.setDiagramTitle=e.a,this.getDiagramTitle=e.F,this.getAccDescription=e.j,this.setAccDescription=e.B}static{(0,g.p)(this,"PacketDB")}getConfig(){let a=(0,d.z)({...i,...(0,e.N)().packet});return a.showBits&&(a.paddingY+=10),a}getPacket(){return this.packet}pushWord(a){a.length>0&&this.packet.push(a)}clear(){(0,e.M)(),this.packet=[]}},k=(0,g.p)((a,c)=>{(0,b.f)(a,c);let d=-1,e=[],g=1,{bitsPerRow:h}=c.getConfig();for(let{start:b,end:i,bits:j,label:k}of a.blocks){if(void 0!==b&&void 0!==i&&i<b)throw Error(`Packet block ${b} - ${i} is invalid. End must be greater than start.`);if((b??=d+1)!==d+1)throw Error(`Packet block ${b} - ${i??b} is not contiguous. It should start from ${d+1}.`);if(0===j)throw Error(`Packet block ${b} is invalid. Cannot have a zero bit field.`);for(i??=b+(j??1)-1,j??=i-b+1,d=i,f.d.debug(`Packet block ${b} - ${d} with label ${k}`);e.length<=h+1&&c.getPacket().length<1e4;){let[a,d]=l({start:b,end:i,bits:j,label:k},g,h);if(e.push(a),a.end+1===g*h&&(c.pushWord(e),e=[],g++),!d)break;({start:b,end:i,bits:j,label:k}=d)}}c.pushWord(e)},"populate"),l=(0,g.p)((a,b,c)=>{if(void 0===a.start)throw Error("start should have been set during first phase");if(void 0===a.end)throw Error("end should have been set during first phase");if(a.start>a.end)throw Error(`Block start ${a.start} is greater than block end ${a.end}.`);if(a.end+1<=b*c)return[a,void 0];let d=b*c-1,e=b*c;return[{start:a.start,end:d,label:a.label,bits:d-a.start},{start:e,end:a.end,label:a.label,bits:a.end-e}]},"getNextFittingBlock"),m={parser:{yy:void 0},parse:(0,g.p)(async a=>{let b=await (0,h.x)("packet",a),c=m.parser?.yy;if(!(c instanceof j))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");f.d.debug(b),k(b,c)},"parse")},n=(0,g.p)((a,b,d,f)=>{let g=f.db,h=g.getConfig(),{rowHeight:i,paddingY:j,bitWidth:k,bitsPerRow:l}=h,m=g.getPacket(),n=g.getDiagramTitle(),p=i+j,q=p*(m.length+1)-(n?0:i),r=k*l+2,s=(0,c.f)(b);for(let[a,b]of(s.attr("viewBox",`0 0 ${r} ${q}`),(0,e.m)(s,q,r,h.useMaxWidth),m.entries()))o(s,b,a,h);s.append("text").text(n).attr("x",r/2).attr("y",q-p/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),o=(0,g.p)((a,b,c,{rowHeight:d,paddingX:e,paddingY:f,bitWidth:g,bitsPerRow:h,showBits:i,bitOrder:j})=>{let k=a.append("g"),l=c*(d+f)+f,m="descending"===j;for(let a of b){let b=a.end-a.start+1,c=a.start%h,f=(m?h-c-b:c)*g+1,j=b*g-e;if(k.append("rect").attr("x",f).attr("y",l).attr("width",j).attr("height",d).attr("class","packetBlock"),k.append("text").attr("x",f+j/2).attr("y",l+d/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(a.label),!i)continue;let[n,o]=m?[a.end,a.start]:[a.start,a.end],p=1===b,q=l-2;k.append("text").attr("x",f+(p?j/2:0)).attr("y",q).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",p?"middle":"start").text(n),p||k.append("text").attr("x",f+j).attr("y",q).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(o)}},"drawWord"),p={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},q=(0,g.p)(({packet:a}={})=>{let b=(0,d.z)(p,a);return`
	.packetByte {
		font-size: ${b.byteFontSize};
	}
	.packetByte.start {
		fill: ${b.startByteColor};
	}
	.packetByte.end {
		fill: ${b.endByteColor};
	}
	.packetLabel {
		fill: ${b.labelColor};
		font-size: ${b.labelFontSize};
	}
	.packetTitle {
		fill: ${b.titleColor};
		font-size: ${b.titleFontSize};
	}
	.packetBlock {
		stroke: ${b.blockStrokeColor};
		stroke-width: ${b.blockStrokeWidth};
		fill: ${b.blockFillColor};
	}
	`},"styles");a.s(["diagram",0,{parser:m,get db(){return new j},renderer:{draw:n},styles:q}])}];

//# sourceMappingURL=06--_mermaid_dist_chunks_mermaid_core_diagram-I5XIIV2D_mjs_081ap9jt-udj7._.js.map