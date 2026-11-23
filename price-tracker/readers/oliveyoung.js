globalThis.PriceReaderSites ??= {};
globalThis.PriceReaderSites.oliveyoung = {
  label: '올리브영',
  eventNames: ['올영세일','올영 세일','올영픽','타임특가','타임세일','오늘의 특가','블랙프라이데이'],
  eventSelectors: ['[data-testid*="promotion"]','[data-testid*="event"]','[data-testid*="badge"]','[class*="promotion"]','[class*="badge"]','[class*="flag"]'],
  defaults: {
    original: {selector:'s > span:nth-of-type(1)',tag:'SPAN',overrideHidden:false},
    sale: {selector:'div:nth-of-type(3) > div > div > button > span:nth-of-type(1) > span:nth-of-type(1)',tag:'SPAN',overrideHidden:false}
  },
  idKeys: ['goodsNo', 'goodsId', 'productNo', 'productId'],
  nameKeys: ['goodsName', 'goodsNm', 'productName', 'productNm'],
  imageKeys: ['goodsImage', 'goodsImageUrl', 'goodsImg', 'imageUrl', 'goodsImgUrl'],
  originalKeys: ['originalPrice', 'normalPrice', 'regularPrice', 'listPrice', 'orgPrice'],
  saleKeys: ['salePrice', 'sellingPrice', 'sellPrice', 'salePrc'],
  globals: ['__NEXT_DATA__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__NUXT__', '__APOLLO_STATE__', 'goodsInfo', 'goodsData', 'productInfo']
};
