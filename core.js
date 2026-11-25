/* Shared geometry and playback decisions, also exercised by the Node checks. */
(function(root){
 const Core={
  nextIndex(index,count){return index+1<count?index+1:null},
  videoRect(width,height,vw,vh){const s=Math.min(width/vw,height/vh);return {x:(width-vw*s)/2,y:(height-vh*s)/2,w:vw*s,h:vh*s}},
  band(rows,y1,y2){let left=1,right=0;for(let y=Math.max(0,Math.floor(y1));y<=Math.min(rows.length-1,Math.ceil(y2));y++){const row=rows[y];if(row){left=Math.min(left,row[0]);right=Math.max(right,row[1])}}return right>left?[left,right]:null},
  intervals(rows,y,font,pad,rect){const band=this.band(rows,(y-rect.y-pad)/rect.h*rows.length,(y+font-rect.y+pad)/rect.h*rows.length);const a=rect.x+16,b=rect.x+rect.w-16;if(!band)return [[a,b]];return [[a,Math.max(a,rect.x+band[0]*rect.w-pad)],[Math.min(b,rect.x+band[1]*rect.w+pad),b]].filter(([x1,x2])=>x2-x1>18)}
 };root.FlowerCore=Core;if(typeof module!=='undefined')module.exports=Core;
})(typeof window!=='undefined'?window:globalThis);
