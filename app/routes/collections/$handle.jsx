import {useLoaderData} from '@remix-run/react';
import {json} from '@shopify/remix-oxygen';
// import invariant from 'tiny-invariant';
import {flattenConnection, AnalyticsPageType} from '@shopify/hydrogen';
import ProductGrid from '../../components/ProductGrid';
import {SortFilter} from '../../components/SortFilter';

const seo = ({data}) => ({
  title: data?.collection?.title,
  description: data?.collection?.description,
});

export const handle = {
  seo,
};

export async function loader({params, context, request}) {
  // invariant(handle, 'Missing collectionHandle param');
  const {handle} = params;

  const searchParams = new URL(request.url).searchParams;
  const knownFilters = ['productVendor', 'productType'];
  const available = 'available';
  const variantOption = 'variantOption';
  const cursor = searchParams.get('cursor');
  const filters = [];
  const appliedFilters = [];

  for (const [key, value] of searchParams.entries()) {
    if (available === key) {
      filters.push({available: value === 'true'});
      appliedFilters.push({
        label: value === 'true' ? 'In stock' : 'Out of stock',
        urlParam: {
          key: available,
          value,
        },
      });
    } else if (knownFilters.includes(key)) {
      filters.push({[key]: value});
      appliedFilters.push({label: value, urlParam: {key, value}});
    } else if (key.includes(variantOption)) {
      const [name, val] = value.split(':');
      filters.push({variantOption: {name, value: val}});
      appliedFilters.push({label: val, urlParam: {key, value}});
    }
  }
  
  if (searchParams.has('minPrice') || searchParams.has('maxPrice')) {
    const price = {};
    if (searchParams.has('minPrice')) {
      price.min = Number(searchParams.get('minPrice')) || 0;
      appliedFilters.push({
        label: `Min: $${price.min}`,
        urlParam: {key: 'minPrice', value: searchParams.get('minPrice')},
      });
    }
    if (searchParams.has('maxPrice')) {
      price.max = Number(searchParams.get('maxPrice')) || 0;
      appliedFilters.push({
        label: `Max: $${price.max}`,
        urlParam: {key: 'maxPrice', value: searchParams.get('maxPrice')},
      });
    }
    filters.push({
      price,
    });
  }

  const {collection, collections} = await context.storefront.query(
    COLLECTION_QUERY,
    {
      variables: {
        handle: handle,
        pageBy: 12,
        cursor,
        filters,
        country: context.storefront.i18n.country,
        language: context.storefront.i18n.language,
      },
    },
  );

  if (!collection) {
    throw new Response(null, {status: 404});
  }

  const collectionNodes = flattenConnection(collections);

  return json({
    collection,
    appliedFilters,
    collections: collectionNodes,
    analytics: {
      pageType: AnalyticsPageType.collection,
      handle,
      resourceId: collection.id,
    },
  });

}

export default function Collection() {
  const {collection, collections, appliedFilters} = useLoaderData();
  console.log('collection.products.filters: ', collection.products.filters);

  const plpDrawerFilters = collection.products.filters.filter(function (currentElement) {
    return currentElement.id == 'filter.v.price' || currentElement.id == 'filter.p.product_type' || currentElement.id == 'filter.v.option.color'
  });
  console.log('new: ', plpDrawerFilters);
  
  return (
    <>
      <header className="grid w-full gap-8 py-8 justify-items-start">
        <h1 className="text-4xl whitespace-pre-wrap font-bold inline-block">
          {collection.title}
        </h1>

        {collection.description && (
          <div className="flex items-baseline justify-between w-full">
            <div>
              <p className="max-w-md whitespace-pre-wrap inherit text-copy inline-block">
                {collection.description}
              </p>
            </div>
          </div>
        )}
      </header>
      <SortFilter
          filters={plpDrawerFilters}
          appliedFilters={appliedFilters}
          collections={collections}
        >
        <ProductGrid
          key={collection.id}
          collection={collection}
          url={`/collections/${collection.handle}`}
          data-test="product-grid"
        />
      </SortFilter>
    </>
  );
}

const COLLECTION_QUERY = `#graphql
  query CollectionDetails(
    $handle: String!
    $cursor: String
    $filters: [ProductFilter!]
  ) {
    collection(handle: $handle) {
      id
      title
      description
      handle
      products(
        first: 12
        after: $cursor
        filters: $filters
      ) {
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          publishedAt
          handle
          variants(first: 1) {
            nodes {
              id
              image {
                url
                altText
                width
                height
              }
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              selectedOptions {
                name
                value
              }
              product {
                handle
                title
              }
            }
          }
        }
      }
    }
    collections(first: 100) {
      edges {
        node {
          title
          handle
        }
      }
    }
  }
`;

function getSortValuesFromParam(sortParam) {
  switch (sortParam) {
    case 'price-high-low':
      return {
        sortKey: 'PRICE',
        reverse: true,
      };
    case 'price-low-high':
      return {
        sortKey: 'PRICE',
        reverse: false,
      };
    case 'best-selling':
      return {
        sortKey: 'BEST_SELLING',
        reverse: false,
      };
    case 'newest':
      return {
        sortKey: 'CREATED',
        reverse: true,
      };
    case 'featured':
      return {
        sortKey: 'MANUAL',
        reverse: false,
      };
    default:
      return {
        sortKey: 'RELEVANCE',
        reverse: false,
      };
  }
}
