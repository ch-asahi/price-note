(() => {
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function scale(low,high){
    const margin=Math.max((high-low)*.12,high*.05,1),bottom=Math.max(0,low-margin),top=high+margin;
    const raw=(top-bottom)/4,power=10**Math.floor(Math.log10(raw)),ratio=raw/power;
    const step=Math.max(1,(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*power);
    const min=Math.floor(bottom/step)*step,max=Math.ceil(top/step)*step,ticks=[];
    for(let value=min;value<=max;value+=step)ticks.push(value);
    return {min,max,step,ticks};
  }
  function render(container,product,days,date=PriceCore.today()){
    const width=620,height=230,pad={left:94,right:12,top:18,bottom:28};
    const start=PriceCore.dateOffset(date,1-days),rows=Object.values(product.records).filter(x=>x.date>=start&&x.date<=date);
    const prices=rows.flatMap(x=>[x.sale,x.original]).filter(x=>x!=null);
    if(!prices.length){container.innerHTML='<div class="empty">이 기간에는 가격 기록이 없습니다.</div>';return;}
    const {min,max,ticks}=scale(Math.min(...prices),Math.max(...prices));
    const x=day=>pad.left+(day/(days-1))*(width-pad.left-pad.right),y=price=>pad.top+(max-price)/(max-min)*(height-pad.top-pad.bottom);
    const money=price=>Math.round(price).toLocaleString('ko-KR');
    let svg=`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="최근 ${days}일 정가와 판매가 추이. 기록하지 않은 날짜는 선이 끊깁니다.">`;
    for(const value of ticks){const yy=y(value);svg+=`<line x1="${pad.left}" x2="${width-pad.right}" y1="${yy}" y2="${yy}" stroke="#eaf0f0"/><text x="${pad.left-8}" y="${yy+4}" text-anchor="end">${money(value)}원</text>`;}
    for(const field of ['original','sale']){
      let path='',active=false;
      for(let index=0;index<days;index++){
        const key=PriceCore.dateOffset(start,index),value=product.records[key]?.[field];
        if(value==null){active=false;continue;}
        path+=`${active?'L':'M'}${x(index).toFixed(2)},${y(value).toFixed(2)} `;active=true;
      }
      svg+=`<path d="${path}" fill="none" stroke="${field==='sale'?'#128266':'#9babb4'}" stroke-width="${field==='sale'?2.5:1.5}" ${field==='original'?'stroke-dasharray="5 4"':''} stroke-linejoin="round"/>`;
      for(const row of rows){const value=row[field];if(value==null)continue;const index=PriceCore.dayNumber(row.date)-PriceCore.dayNumber(start);svg+=`<circle cx="${x(index)}" cy="${y(value)}" r="${days>90?2:3}" fill="${field==='sale'?'#128266':'#9babb4'}"><title>${row.date} · ${field==='sale'?'판매가':'정가'} ${money(value)}원${row.eventName?' · '+escape(row.eventName):''}</title></circle>`;}
    }
    for(const [index,anchor] of [[0,'start'],[Math.round((days-1)/2),'middle'],[days-1,'end']]){const key=PriceCore.dateOffset(start,index);svg+=`<text x="${x(index)}" y="${height-4}" text-anchor="${anchor}">${key.slice(5).replace('-','.')}</text>`;}
    svg+='</svg>';container.innerHTML=svg;
  }
  globalThis.PriceChart={render,scale};
})();
