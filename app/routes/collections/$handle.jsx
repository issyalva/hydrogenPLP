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
  //const {collectionHandle} = params;
  const {handle} = params;
  // invariant(handle, 'Missing collectionHandle param');

  const searchParams = new URL(request.url).searchParams;
  const cursor = searchParams.get('cursor');
  const available = 'available';
  const variantOption = 'variantOption';
  const {sortKey, reverse} = getSortValuesFromParam(searchParams.get('sort'));
  const knownFilters = ['productVendor', 'productType'];
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

    const {collection, collections} = await context.storefront.query(
      COLLECTION_QUERY,
      {
        variables: {
          handle: handle,
          pageBy: 6,
          cursor,
          filters,
          sortKey,
          reverse,
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
        handle
        // collectionHandle,
        // resourceId: collection.id,
      },
    });
  }

  const {collection} = await context.storefront.query(COLLECTION_QUERY, {
    variables: {
      handle,
      cursor,
    },
  });

  // Handle 404s
  if (!collection) {
    throw new Response(null, {status: 404});
  }

  // json is a Remix utility for creating application/json responses
  // https://remix.run/docs/en/v1/utils/json
  return json({
    collection,
  });
}

export const meta = ({data}) => {
  return {
    title: data?.collection?.title ?? 'Collection',
    description: data?.collection?.description,
  };
};

export default function Collection() {
  const {collection, collections, appliedFilters} = useLoaderData();
  console.log('collection: ,', collection);
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
          filters={collection.products.filters}
          appliedFilters={appliedFilters}
          collections={collections}
        >
        <ProductGrid
          collection={collection}
          url={`/collections/${collection.handle}`}
        />
      </SortFilter>
    </>
  );
}

const COLLECTION_QUERY = `#graphql
  query CollectionDetails($handle: String!, $cursor: String, $filters: [ProductFilter!]) {
    collection(handle: $handle) {
      id
      title
      description
      handle
      products(
        first: 10
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
