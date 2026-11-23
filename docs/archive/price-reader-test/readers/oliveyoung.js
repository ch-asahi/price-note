globalThis.PriceReaderSites ??= {};
globalThis.PriceReaderSites.oliveyoung = {
  label: '올리브영',
  idKeys: ['goodsNo', 'goodsId', 'productNo', 'productId'],
  nameKeys: ['goodsName', 'goodsNm', 'productName', 'productNm'],
  imageKeys: ['goodsImage', 'goodsImageUrl', 'goodsImg', 'imageUrl', 'goodsImgUrl'],
  originalKeys: ['originalPrice', 'normalPrice', 'regularPrice', 'listPrice', 'orgPrice'],
  saleKeys: ['salePrice', 'sellingPrice', 'sellPrice', 'salePrc'],
  globals: ['__NEXT_DATA__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__NUXT__', '__APOLLO_STATE__', 'goodsInfo', 'goodsData', 'productInfo']
};
