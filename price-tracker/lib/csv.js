(() => {
  const columns=['format','productKey','site','url','name','imageUrl','createdAt','configJson','date','originalPrice','salePrice','eventName','recordedAt','source','loginState','optionName','optionPriceDiffers','loginPriceDiffers','loginComparison','method'];
  const legacyColumns=columns.filter(x=>x!=='eventName');
  const cell=value=>{const text=String(value??'');const safe=/^[\s]*[=+\-@]/.test(text)||text.startsWith("'")?'\''+text:text;return '"'+safe.replaceAll('"','""')+'"';};
  const uncell=value=>value.startsWith("''")||/^'[\s]*[=+\-@]/.test(value)?value.slice(1):value;
  function encode(products) {
    const rows=[columns.map(cell).join(',')];
    for (const product of Object.values(products)) {
      const records=Object.values(product.records||{}).sort((a,b)=>a.date.localeCompare(b.date));
      for (const record of records.length?records:[{}]) rows.push([2,product.key,product.site,product.url,product.name,product.imageUrl,product.createdAt,JSON.stringify(product.config),record.date,record.original,record.sale,record.eventName,record.recordedAt,record.source,record.loginState,record.optionName,record.optionPriceDiffers,record.loginPriceDiffers,record.loginComparison,record.method].map(cell).join(','));
    }
    return '\uFEFF'+rows.join('\r\n');
  }
  function parse(text) {
    if (typeof text!=='string' || text.length>18000000) throw new Error('CSV는 18MB 이하로 가져올 수 있습니다.');
    text=text.replace(/^\uFEFF/,'');
    const rows=[];let row=[],field='',quoted=false,closed=false;
    for(let index=0;index<text.length;index++) {
      const char=text[index];
      if(quoted) { if(char==='"') { if(text[index+1]==='"') {field+='"';index++;} else {quoted=false;closed=true;} } else field+=char; }
      else if(char==='"') { if(field || closed) throw new Error('CSV 따옴표 형식이 잘못됐습니다.'); quoted=true; }
      else if(char===',' || char==='\r' || char==='\n') {
        row.push(uncell(field));field='';closed=false;
        if(char!==','){ if(char==='\r' && text[index+1]==='\n')index++; if(row.some(x=>x!==''))rows.push(row);row=[]; }
      } else {if(closed)throw new Error('CSV 따옴표 뒤에 잘못된 문자가 있습니다.');field+=char;}
      if(rows.length>100000)throw new Error('CSV 기록 수가 너무 많습니다.');
    }
    if(quoted)throw new Error('닫히지 않은 CSV 따옴표가 있습니다.');
    if(field || row.length || closed){row.push(uncell(field));rows.push(row);}
    const legacy=rows.length&&JSON.stringify(rows[0])===JSON.stringify(legacyColumns);
    if(!rows.length || (!legacy&&JSON.stringify(rows[0])!==JSON.stringify(columns)))throw new Error('가격노트에서 내보낸 CSV 형식이 아닙니다.');
    const header=legacy?legacyColumns:columns;
    const products={};
    for(const [index,values] of rows.slice(1).entries()) {
      if(values.length!==header.length)throw new Error(`CSV ${index+2}행 열 수가 다릅니다.`);
      const raw=Object.fromEntries(header.map((key,i)=>[key,values[i]]));
      if(raw.format!==(legacy?'1':'2'))throw new Error('지원하지 않는 CSV 버전입니다.');
      const target=PriceCore.parseProduct(raw.url);
      if(!target || raw.productKey!==target.key || raw.site!==target.site)throw new Error(`CSV ${index+2}행 상품 주소가 올바르지 않습니다.`);
      if(!raw.name || raw.name.length>300)throw new Error('상품명이 없거나 너무 깁니다.');
      if(raw.imageUrl && !/^https?:\/\//.test(raw.imageUrl))throw new Error('이미지 주소가 올바르지 않습니다.');
      let config;try{config=PriceCore.normalizeConfig(JSON.parse(raw.configJson));}catch{throw new Error('상품 설정 JSON이 잘못됐습니다.');}
      const product=products[target.key] ||= {...target,name:raw.name,imageUrl:raw.imageUrl.slice(0,2000),createdAt:raw.createdAt||new Date().toISOString(),config,records:{}};
      if(raw.salePrice || raw.date) {
        if(!raw.salePrice || !raw.date || !raw.recordedAt)throw new Error('가격 기록의 날짜·가격·시간이 빠졌습니다.');
        PriceCore.putRecord(product,PriceCore.validateRecord({date:raw.date,original:raw.originalPrice,sale:raw.salePrice,eventName:raw.eventName,recordedAt:raw.recordedAt,source:raw.source,loginState:raw.loginState,optionName:raw.optionName,optionPriceDiffers:raw.optionPriceDiffers===''?null:raw.optionPriceDiffers==='true',loginPriceDiffers:raw.loginPriceDiffers==='true',loginComparison:raw.loginComparison,method:raw.method}));
      }
    }
    if(Object.keys(products).length>PriceCore.MAX_PRODUCTS)throw new Error('CSV에 상품이 50개보다 많습니다.');
    return products;
  }
  function merge(existing,incoming) {
    const result=structuredClone(existing);
    for(const [key,product] of Object.entries(incoming)) {
      if(!result[key])result[key]=structuredClone(product);
      else for(const record of Object.values(product.records)) PriceCore.putRecord(result[key],record);
    }
    if(Object.keys(result).length>PriceCore.MAX_PRODUCTS)throw new Error('가져온 뒤 상품 수가 50개를 넘습니다.');
    return result;
  }
  globalThis.PriceCSV={columns,encode,parse,merge};
})();
