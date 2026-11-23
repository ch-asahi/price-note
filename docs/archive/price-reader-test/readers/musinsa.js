globalThis.PriceReaderSites ??= {};
globalThis.PriceReaderSites.musinsa = {
  label: '무신사',
  idKeys: ['goodsNo', 'goodsId', 'goodsNumber', 'productNo', 'productId'],
  nameKeys: ['goodsName', 'goodsNm', 'productName', 'productNm'],
  imageKeys: ['goodsImage', 'goodsImageUrl', 'goodsImg', 'imageUrl', 'thumbnailImageUrl'],
  originalKeys: ['normalPrice', 'originalPrice', 'regularPrice', 'listPrice', 'goodsPrice'],
  saleKeys: ['salePrice', 'sellingPrice', 'sellPrice', 'goodsSalePrice'],
  globals: ['__NEXT_DATA__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__NUXT__', '__APOLLO_STATE__', 'goodsInfo', 'goodsData', 'productInfo']
};
