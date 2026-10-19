'use strict';
const ASPECT={default:1207/1303,chatgpt:2/3,claude:2/3};
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function welcomeLayout(width,height,preset,composer) {
  if(width<300||height<320||!composer)return null;
  const ratio=ASPECT[preset]||ASPECT.default,margin=24,gap=28;
  let h=(height-48)*(preset==='default'?1/3:2/3),lane=0;
  if(width<900||height<520){
    const below=height-composer.y-composer.height-margin-gap,above=composer.y-margin-gap;
    const useBelow=below>=112||below>=above,available=useBelow?below:above;
    h=Math.min(190,available,(width*.38)/ratio);
    if(h<100)return null;
    const image={x:width-margin-h*ratio,y:useBelow?height-margin-h:margin,width:h*ratio,height:h};
    const bubble={x:Math.max(12,image.x-194),y:Math.max(margin,image.y+h*.10),width:182,height:76};
    if(overlaps(bubble,composer)||overlaps(image,composer))return null;
    return{image,bubble,lane:0,compact:true};
  }
  // Keep a useful composer width even on tall/narrow desktop windows.
  h=Math.min(h,Math.max(130,(width-520-margin*2-gap)/ratio));
  const image={x:width-margin-h*ratio,y:height-margin-h,width:h*ratio,height:h};
  const bubble={x:Math.max(margin,image.x+image.width*(preset==='default'?0:.3)-248-16),y:image.y+h*.08,width:248,height:82};
  const verticalOverlap=rect=>rect.y<composer.y+composer.height&&rect.y+rect.height>composer.y;
  if(preset!=='default'||verticalOverlap(image)||verticalOverlap(bubble)){
    // Reserve the whole decoration column, including the bubble's left edge.
    // Place the bubble above the composer when that avoids excessive shrinkage.
    if(verticalOverlap(bubble)&&bubble.x<image.x-gap){bubble.y=Math.max(margin,composer.y-bubble.height-gap);}
    lane=width-image.x+gap;
    if(overlaps(bubble,{x:margin,y:composer.y,width:width-lane-margin,height:composer.height}))return null;
  }
  return{image,bubble,lane,compact:false};
}
module.exports={welcomeLayout,overlaps};
