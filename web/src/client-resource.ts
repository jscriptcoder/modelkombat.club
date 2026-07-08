import {
  createResource,
  createSignal,
  onMount,
  type ResourceReturn,
} from "solid-js";

// A `createResource` whose fetch is deferred to the client. The source signal is
// `false` during SSR and the first hydrated paint — so the prerendered HTML and the
// client's first frame both render the resource's *fallback* branch and agree, with no
// hydration mismatch — then `onMount` (which never runs on the server) flips it true so
// the fetch fires only in the browser after hydration. Used by the King and
// Hall-of-Kings sections, which stay client-side over prerendered empty-state fallbacks.
export const createClientResource = <T>(
  fetcher: () => Promise<T>,
): ResourceReturn<T> => {
  const [shouldFetch, setShouldFetch] = createSignal(false);

  onMount(() => setShouldFetch(true));

  return createResource(shouldFetch, fetcher);
};
