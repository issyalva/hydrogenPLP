import {useFetcher} from '@remix-run/react';
import {useEffect, useState} from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({collection, url}) {
  const [initialProducts, setInitialProducts] = useState(
    collection?.products?.nodes || [],
  );

  const [nextPage, setNextPage] = useState(
    collection.products.pageInfo.hasNextPage,
  );

  const [endCursor, setEndCursor] = useState(
    collection?.products?.pageInfo?.endCursor,
  );

  const [products, setProducts] = useState(initialProducts);

  const productProps = collection?.products?.nodes || [];
  if (initialProducts !== productProps) {
    setInitialProducts(productProps);
    setProducts(productProps);
  }

  const fetcher = useFetcher();

  function fetchMoreProducts() {
    fetcher.load(`${url}?index&cursor=${endCursor}`);
  }

  useEffect(() => {
    if (!fetcher.data) return;
    const {collection} = fetcher.data;

    setProducts((prev) => [...prev, ...collection.products.nodes]);
    setNextPage(collection.products.pageInfo.hasNextPage);
    setEndCursor(collection.products.pageInfo.endCursor);
  }, [fetcher.data]);

  const haveProducts = initialProducts.length > 0;

  if (!haveProducts) {
    return (
      <>
        <p className="text-center mt-4">No products found</p>
      </>
    );
  }

  return (
    <section className="w-full gap-4 md:gap-8 grid">
      <div className="grid-flow-row grid gap-2 gap-y-6 md:gap-4 lg:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {nextPage && (
        <div className="flex items-center justify-center mt-6">
          <button
            className="inline-block rounded font-medium text-center py-3 px-6 border w-full cursor-pointer"
            disabled={fetcher.state !== 'idle'}
            onClick={fetchMoreProducts}
          >
            {fetcher.state !== 'idle' ? 'Loading...' : 'Load more products'}
          </button>
        </div>
      )}
    </section>
  );
}
