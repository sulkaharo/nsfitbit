export function coloralloc(sgv, lowthres, hithresh, multicolbool){
  let clr = "green";
  if(!multicolbool){
    if (sgv >= hithresh) {
      clr= "red";
    } else if (sgv <= lowthres) {
      clr = "red";
    }
    return clr;
  }
  if (sgv >= hithresh*2.6){
    clr= '#e3b4f3';
  } else if (sgv > hithresh*2.4) {
    clr= '#D6A7E6';
  } else if (sgv > hithresh*2.2) {
    clr= '#b800f5';
  } else if (sgv > hithresh*2.00) {
    clr= '#d452ff';
  } else if (sgv > hithresh*1.80) {
    clr= '#fd20d7';
  } else if (sgv > hithresh*1.70) {
    clr= '#ee59d5';
  } else if (sgv > hithresh*1.60) {
    clr= '#f38ee2';
  } else if (sgv > hithresh*1.50) {
    clr= '#f44496';
  } else if (sgv > hithresh*1.40) {
    clr= '#f76767';
  } else if (sgv > hithresh*1.30) {
    clr= '#f93434';
  } else if (sgv > hithresh*1.20) {
    clr= '#FF5722';
  } else if (sgv > hithresh*1.15) {
    clr= '#ffa500';
  } else if (sgv > hithresh*1.10) {
    clr= '#ffbf00';
  } else if (sgv > hithresh) {
    clr= '#ffff00';
  } else if (sgv > hithresh*0.80) {
    clr= '#aaee02';
  } else if (sgv > hithresh*0.65) {
    clr= '#3fce02';
  } else if (sgv > lowthres*1.20) {
    clr= '#02ad27';
  } else if (sgv > lowthres) {
    clr= '#06bbbb';
  }else{
    clr= '#2196f3';
  }
  return clr;
}
