"use client";

import {
  FormEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader
} from "@react-google-maps/api";
import type { BeerSpot } from "@prisma/client";
import { signIn, signOut, useSession } from "next-auth/react";
import styles from "./beer-map-screen.module.css";

const libraries: ("places")[] = ["places"];

const defaultCenter = {
  lat: 37.5665,
  lng: 126.978
};

type BeerSpotInput = {
  name: string;
  address: string;
  description: string;
  beerType: string;
  rating: number;
  lat: number;
  lng: number;
};

type SearchResult = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type SearchSuggestion = {
  placeId: string;
  text: string;
  secondaryText: string;
};

type AggregatedBeerSpot = {
  id: string;
  key: string;
  name: string;
  address: string;
  description: string;
  beerType: string;
  rating: number;
  lat: number;
  lng: number;
  reviewCount: number;
  descriptions: string[];
  styles: string[];
  sourceSpots: BeerSpot[];
};

type ViewMode = "map" | "mypage";

type Props = {
  initialSpots: BeerSpot[];
};

const beerStyleOptions = [
  "Lager",
  "Pilsner",
  "Pale Ale",
  "IPA",
  "Hazy IPA",
  "Wheat Beer",
  "Saison",
  "Sour",
  "Stout",
  "Porter",
  "Belgian Ale",
  "Amber Ale",
  "Brown Ale",
  "Barleywine",
  "Cider",
  "Non-alcoholic"
];

function parseBeerStyles(value: string) {
  return value
    .split(",")
    .map((style) => style.trim())
    .filter(Boolean);
}

function normalizePlacePart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getPlaceKey(spot: BeerSpot) {
  const address = normalizePlacePart(spot.address);
  const name = normalizePlacePart(spot.name);

  if (address) {
    return `${name}|${address}`;
  }

  return `${name}|${spot.lat.toFixed(5)},${spot.lng.toFixed(5)}`;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function aggregateBeerSpots(spots: BeerSpot[]): AggregatedBeerSpot[] {
  const groups = new Map<string, BeerSpot[]>();

  spots.forEach((spot) => {
    const key = getPlaceKey(spot);
    groups.set(key, [...(groups.get(key) ?? []), spot]);
  });

  return Array.from(groups.entries())
    .map(([key, sourceSpots]) => {
      const first = sourceSpots[0];
      const totalRating = sourceSpots.reduce((sum, spot) => sum + spot.rating, 0);
      const descriptions = uniqueValues(sourceSpots.map((spot) => spot.description));
      const styles = uniqueValues(sourceSpots.flatMap((spot) => parseBeerStyles(spot.beerType)));

      return {
        id: first.id,
        key,
        name: first.name,
        address: first.address,
        description: descriptions.join(" / "),
        beerType: styles.join(", "),
        rating: totalRating / sourceSpots.length,
        lat: first.lat,
        lng: first.lng,
        reviewCount: sourceSpots.length,
        descriptions,
        styles,
        sourceSpots
      };
    })
    .sort((a, b) => {
      const newestA = Math.max(
        ...a.sourceSpots.map((spot) => new Date(spot.createdAt).getTime())
      );
      const newestB = Math.max(
        ...b.sourceSpots.map((spot) => new Date(spot.createdAt).getTime())
      );
      return newestB - newestA;
    });
}

export function BeerMapScreen({ initialSpots }: Props) {
  const { data: session, status } = useSession();
  const [authAction, setAuthAction] = useState<"signin" | "signout" | null>(null);
  const [spots, setSpots] = useState(initialSpots);
  const [selectedSpot, setSelectedSpot] = useState<AggregatedBeerSpot | null>(
    null
  );
  const [draftLocation, setDraftLocation] = useState(defaultCenter);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [form, setForm] = useState<BeerSpotInput>({
    name: "",
    address: "",
    description: "",
    beerType: "",
    rating: 4.5,
    lat: defaultCenter.lat,
    lng: defaultCenter.lng
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const myMapRef = useRef<google.maps.Map | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);
  const placeNameInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(
    null
  );

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries
  });

  const places = useMemo(() => aggregateBeerSpots(spots), [spots]);
  const averageRating = useMemo(() => {
    if (!places.length) {
      return null;
    }

    const total = places.reduce((sum, spot) => sum + spot.rating, 0);
    return (total / places.length).toFixed(1);
  }, [places]);

  const canCreate = Boolean(session?.user?.email && session?.user?.name);
  const mySpots = useMemo(
    () => spots.filter((spot) => spot.userEmail === session?.user?.email),
    [session?.user?.email, spots]
  );
  const myPlaces = useMemo(() => aggregateBeerSpots(mySpots), [mySpots]);
  const myAverageRating = useMemo(() => {
    if (!myPlaces.length) {
      return null;
    }

    const total = myPlaces.reduce((sum, spot) => sum + spot.rating, 0);
    return (total / myPlaces.length).toFixed(1);
  }, [myPlaces]);
  const selectedBeerStyles = useMemo(
    () => parseBeerStyles(form.beerType),
    [form.beerType]
  );
  const isAuthLoading = authAction !== null;

  useEffect(() => {
    if (!isLoaded || autocompleteServiceRef.current) {
      return;
    }

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  useEffect(() => {
    if (!autocompleteServiceRef.current || !searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const query = searchQuery.trim();
    const timeoutId = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: query,
          locationBias: {
            center: new google.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
            radius: 30000
          }
        },
        (predictions, statusCode) => {
          if (
            statusCode !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions?.length
          ) {
            setSearchSuggestions([]);
            return;
          }

          setSearchSuggestions(
            predictions.slice(0, 5).map((prediction) => ({
              placeId: prediction.place_id,
              text: prediction.structured_formatting.main_text,
              secondaryText:
                prediction.structured_formatting.secondary_text ?? prediction.description
            }))
          );
        }
      );
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!myMapRef.current || !myPlaces.length || viewMode !== "mypage") {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    myPlaces.forEach((spot) => {
      bounds.extend({ lat: spot.lat, lng: spot.lng });
    });
    myMapRef.current.fitBounds(bounds);
  }, [myPlaces, viewMode]);

  async function refreshSpots() {
    const response = await fetch("/api/spots", {
      cache: "no-store"
    });
    const data = (await response.json()) as BeerSpot[];
    setSpots(data);
  }

  function syncDraftLocation(location: { lat: number; lng: number }) {
    setDraftLocation(location);
    setForm((current) => ({
      ...current,
      lat: location.lat,
      lng: location.lng
    }));
  }

  function handleMapClick(event: google.maps.MapMouseEvent) {
    if (!event.latLng) {
      return;
    }

    syncDraftLocation({
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    });
  }

  async function performSearch(query: string) {
    setSearchError(null);

    if (!query.trim()) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setSearchError("Please enter a place name or area.");
      return;
    }

    if (!mapRef.current) {
      setSearchError("The map is not ready yet.");
      return;
    }

    setIsSearching(true);

    const service = new google.maps.places.PlacesService(mapRef.current);
    const request: google.maps.places.TextSearchRequest = {
      query,
      location: new google.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
      radius: 20000
    };

    try {
      const results = await new Promise<google.maps.places.PlaceResult[]>(
        (resolve, reject) => {
          service.textSearch(request, (places, statusCode) => {
            if (
              statusCode !== google.maps.places.PlacesServiceStatus.OK ||
              !places?.length
            ) {
              reject(new Error("No search results found."));
              return;
            }

            resolve(places);
          });
        }
      );

      const normalized = results
        .filter((place) => place.geometry?.location && place.place_id)
        .map((place) => ({
          placeId: place.place_id as string,
          name: place.name ?? "Unknown place",
          address: place.formatted_address ?? "",
          lat: place.geometry?.location?.lat() ?? defaultCenter.lat,
          lng: place.geometry?.location?.lng() ?? defaultCenter.lng
        }));

      setSearchResults(normalized);
      setSearchSuggestions([]);

      if (!normalized.length) {
        setSearchError("No result with map location was found.");
      }
    } catch (searchFailure) {
      setSearchResults([]);
      setSearchError(
        searchFailure instanceof Error
          ? searchFailure.message
          : "Something went wrong while searching."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performSearch(searchQuery);
  }

  async function handleSuggestionSelect(text: string) {
    setSearchQuery(text);
    await performSearch(text);
  }

  function applySearchResult(result: SearchResult) {
    syncDraftLocation({
      lat: result.lat,
      lng: result.lng
    });
    setForm((current) => ({
      ...current,
      name: result.name,
      address: result.address,
      lat: result.lat,
      lng: result.lng
    }));
    mapRef.current?.panTo({
      lat: result.lat,
      lng: result.lng
    });
    mapRef.current?.setZoom(16);
    setSearchResults([]);
    setSearchQuery(result.name);
    setViewMode("map");
    window.requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      placeNameInputRef.current?.focus();
    });
  }

  function updateRatingFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const raw = (x / rect.width) * 5;
    const nextRating = Math.min(5, Math.max(0.5, Math.ceil(raw * 2) / 2));

    setForm((current) => ({
      ...current,
      rating: nextRating
    }));
  }

  function toggleBeerStyle(style: string) {
    const nextStyles = selectedBeerStyles.includes(style)
      ? selectedBeerStyles.filter((selectedStyle) => selectedStyle !== style)
      : [...selectedBeerStyles, style];

    setForm((current) => ({
      ...current,
      beerType: nextStyles.join(", ")
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreate) {
      setError("Please sign in with Google first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/spots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Could not save this pin.");
      }

      await refreshSpots();
      setForm({
        name: "",
        address: "",
        description: "",
        beerType: "",
        rating: 4.5,
        lat: draftLocation.lat,
        lng: draftLocation.lng
      });
      setSearchQuery("");
      setSearchResults([]);
      setSearchSuggestions([]);
      setViewMode("mypage");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);

    const response = await fetch(`/api/spots/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setError(payload.message ?? "Could not delete this pin.");
      return;
    }

    if (selectedSpot?.sourceSpots.some((spot) => spot.id === id)) {
      setSelectedSpot(null);
    }

    await refreshSpots();
  }

  function renderRatingStars(rating: number) {
    const percentage = `${Math.min(100, Math.max(0, (rating / 5) * 100))}%`;

    return (
      <span className={styles.ratingStars} aria-hidden="true">
        <span className={styles.ratingStarsEmpty}>★★★★★</span>
        <span className={styles.ratingStarsFilled} style={{ width: percentage }}>
          ★★★★★
        </span>
      </span>
    );
  }

  function renderSpotInfoWindow(spot: AggregatedBeerSpot) {
    const mySourceSpots = spot.sourceSpots.filter(
      (sourceSpot) => sourceSpot.userEmail === session?.user?.email
    );

    return (
      <div className={styles.infoWindow}>
        <h3>{spot.name}</h3>
        <p>{spot.address || "No address listed"}</p>
        <p>
          {renderRatingStars(spot.rating)}
          <span className={styles.ratingText}>
            {spot.rating.toFixed(1)}/5 from {spot.reviewCount}{" "}
            {spot.reviewCount === 1 ? "rating" : "ratings"}
          </span>
        </p>
        {spot.styles.length ? <p>Beer Style: {spot.styles.join(", ")}</p> : null}
        {spot.descriptions.length ? (
          <div className={styles.infoList}>
            {spot.descriptions.map((description) => (
              <p key={description}>{description}</p>
            ))}
          </div>
        ) : null}
        {mySourceSpots.map((sourceSpot) => (
          <button
            key={sourceSpot.id}
            className={styles.deleteButton}
            onClick={() => handleDelete(sourceSpot.id)}
            type="button"
          >
            Delete My Pin
          </button>
        ))}
      </div>
    );
  }

  async function handleSignIn() {
    setAuthAction("signin");
    await signIn("google");
  }

  async function handleSignOut() {
    setAuthAction("signout");
    await signOut();
  }

  function renderBeerLoader() {
    return (
      <main className={styles.state}>
        <div className={styles.authLoader}>
          <div className={styles.authLoaderCircle}>
            <img alt="" aria-hidden="true" className={styles.beerSvg} src="/beer-loader.png" />
            <p className={styles.loaderLabel}>Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return <main className={styles.state}>Could not load Google Maps.</main>;
  }

  if (!isLoaded) {
    return renderBeerLoader();
  }

  return (
    <main className={styles.page}>
      <div className={styles.appShell}>
        {isAuthLoading ? (
          <div className={styles.authLoader} aria-live="polite">
            <div className={styles.authLoaderCircle}>
              <img alt="" aria-hidden="true" className={styles.beerSvg} src="/beer-loader.png" />
              <p className={styles.loaderLabel}>Loading...</p>
            </div>
          </div>
        ) : null}

        <header className={styles.topBar}>
          <div>
            <p className={styles.appTag}>BEER MAP</p>
            <button
              className={styles.homeTitle}
              onClick={() => setViewMode("map")}
              type="button"
            >
              BEER MAP
            </button>
          </div>

          {session?.user ? (
            <div className={styles.authArea}>
              <button
                className={`${styles.userNameButton} ${
                  viewMode === "mypage" ? styles.userNameButtonActive : ""
                }`}
                disabled={authAction !== null}
                onClick={() => setViewMode("mypage")}
                type="button"
              >
                {session.user.name ?? "My Page"}
              </button>
              <button
                className={styles.pillButton}
                disabled={authAction !== null}
                onClick={handleSignOut}
                type="button"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              className={styles.pillButton}
              disabled={status === "loading" || authAction !== null}
              onClick={handleSignIn}
              type="button"
            >
              {status === "loading" ? "Loading..." : "Sign In with Google"}
            </button>
          )}
        </header>

        <section className={styles.heroCard}>
          <div className={styles.statRow}>
            <button
              className={`${styles.statCard} ${viewMode === "map" ? styles.activeTab : ""}`}
              onClick={() => setViewMode("map")}
              type="button"
            >
              <span>Saved Places</span>
              <strong>{viewMode === "map" ? places.length : myPlaces.length}</strong>
            </button>
            <article className={styles.statCard}>
              <span>{viewMode === "map" ? "Average Rating" : "My Average Rating"}</span>
              <strong>{viewMode === "map" ? averageRating ?? "-" : myAverageRating ?? "-"}</strong>
            </article>
          </div>
        </section>

        {viewMode === "map" ? (
          <section className={styles.mainGrid}>
            <section className={styles.mapPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Explore</p>
                  <h2>Search Beer Spots</h2>
                </div>
              </div>

              <form className={styles.searchBar} onSubmit={handleSearch}>
                <input
                  placeholder="Try: Seoul ale house, Itaewon pub"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <button type="submit" disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {searchSuggestions.length ? (
                <div className={styles.suggestionList}>
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      className={styles.suggestionItem}
                      onClick={() => handleSuggestionSelect(suggestion.text)}
                      type="button"
                    >
                      <strong>{suggestion.text}</strong>
                      <span>{suggestion.secondaryText}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {searchError ? <p className={styles.error}>{searchError}</p> : null}

              {searchResults.length ? (
                <div className={styles.searchResults}>
                  {searchResults.map((result) => (
                    <button
                      key={result.placeId}
                      className={styles.searchResultItem}
                      onClick={() => applySearchResult(result)}
                      type="button"
                    >
                      <strong>{result.name}</strong>
                      <span>{result.address || "No address listed"}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <GoogleMap
                center={defaultCenter}
                mapContainerClassName={styles.map}
                zoom={13}
                onClick={handleMapClick}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                onUnmount={() => {
                  mapRef.current = null;
                }}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                  clickableIcons: false
                }}
              >
                {places.map((spot) => (
                  <MarkerF
                    key={spot.key}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    onClick={() => setSelectedSpot(spot)}
                  />
                ))}

                <MarkerF
                  position={draftLocation}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: "#f28c28",
                    fillOpacity: 1,
                    strokeColor: "#fff7ed",
                    strokeWeight: 3,
                    scale: 7
                  }}
                />

                {selectedSpot ? (
                  <InfoWindowF
                    position={{ lat: selectedSpot.lat, lng: selectedSpot.lng }}
                    onCloseClick={() => setSelectedSpot(null)}
                  >
                    {renderSpotInfoWindow(selectedSpot)}
                  </InfoWindowF>
                ) : null}
              </GoogleMap>
            </section>

            <aside className={styles.sideStack}>
              <section
                className={styles.formPanel}
                ref={(element) => {
                  formPanelRef.current = element;
                }}
              >
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Create</p>
                    <h2>Add a New Pin</h2>
                  </div>
                  <span
                    className={
                      session?.user?.name ? styles.inlineBadge : styles.authHint
                    }
                  >
                    {session?.user?.name
                      ? "Ready to save"
                      : "Sign in before saving"}
                  </span>
                </div>

                <form className={styles.formCard} onSubmit={handleSubmit}>
                  <label>
                    Place Name
                    <input
                      ref={placeNameInputRef}
                      required
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Address
                    <input
                      value={form.address}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, address: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Why do you like it? <span className={styles.optional}>Optional</span>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>

                  <fieldset className={styles.styleField}>
                    <legend>
                      Beer Style <span className={styles.optional}>Optional</span>
                    </legend>
                    <div className={styles.styleGrid}>
                      {beerStyleOptions.map((style) => (
                        <label
                          key={style}
                          className={`${styles.styleOption} ${
                            selectedBeerStyles.includes(style)
                              ? styles.styleOptionSelected
                              : ""
                          }`}
                        >
                          <input
                            checked={selectedBeerStyles.includes(style)}
                            onChange={() => toggleBeerStyle(style)}
                            type="checkbox"
                          />
                          <span>{style}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className={styles.ratingField}>
                    <span>Rating</span>
                    <div
                      className={styles.ratingControl}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        updateRatingFromPointer(event);
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons === 1) {
                          updateRatingFromPointer(event);
                        }
                      }}
                      role="slider"
                      aria-label="Rating"
                      aria-valuemin={0.5}
                      aria-valuemax={5}
                      aria-valuenow={form.rating}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                          setForm((current) => ({
                            ...current,
                            rating: Math.max(0.5, current.rating - 0.5)
                          }));
                        }
                        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                          setForm((current) => ({
                            ...current,
                            rating: Math.min(5, current.rating + 0.5)
                          }));
                        }
                      }}
                    >
                      {renderRatingStars(form.rating)}
                    </div>
                    <strong>{form.rating.toFixed(1)}</strong>
                  </div>

                  {!session?.user?.name ? (
                    <p className={styles.helperText}>
                      Sign in with Google before saving this place.
                    </p>
                  ) : null}

                  {error ? <p className={styles.error}>{error}</p> : null}

                  <button
                    className={styles.submitButton}
                    disabled={isSubmitting || !canCreate}
                    type="submit"
                  >
                    {isSubmitting ? "Saving..." : "Save This Pin"}
                  </button>
                </form>
              </section>

              <section className={styles.listPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Community</p>
                    <h2>Latest Pins</h2>
                  </div>
                </div>

                <div className={styles.spotList}>
                  {places.length ? (
                    places.map((spot) => (
                      <button
                        key={spot.key}
                        className={styles.spotItem}
                        onClick={() => setSelectedSpot(spot)}
                        type="button"
                      >
                        <strong>{spot.name}</strong>
                        <span>{spot.address || "No address listed"}</span>
                        <span>
                          {spot.rating.toFixed(1)}/5 · {spot.reviewCount}{" "}
                          {spot.reviewCount === 1 ? "rating" : "ratings"} ·{" "}
                          {spot.beerType || "No style yet"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className={styles.empty}>Be the first to add a beer spot.</p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        ) : (
          <section className={styles.myPageGrid}>
            <section className={styles.mapPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>My Page</p>
                  <h2>My Average Rating</h2>
                </div>
                <span className={styles.inlineBadge}>{myPlaces.length} saved</span>
              </div>

              <GoogleMap
                center={myPlaces[0] ? { lat: myPlaces[0].lat, lng: myPlaces[0].lng } : defaultCenter}
                mapContainerClassName={styles.map}
                zoom={13}
                onLoad={(map) => {
                  myMapRef.current = map;
                }}
                onUnmount={() => {
                  myMapRef.current = null;
                }}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                  clickableIcons: false
                }}
              >
                {myPlaces.map((spot) => (
                  <MarkerF
                    key={spot.key}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    onClick={() => setSelectedSpot(spot)}
                  />
                ))}

                {selectedSpot ? (
                  <InfoWindowF
                    position={{ lat: selectedSpot.lat, lng: selectedSpot.lng }}
                    onCloseClick={() => setSelectedSpot(null)}
                  >
                    {renderSpotInfoWindow(selectedSpot)}
                  </InfoWindowF>
                ) : null}
              </GoogleMap>
            </section>

            <section className={styles.listPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>My List</p>
                  <h2>My Saved List</h2>
                </div>
                <span className={styles.inlineBadge}>{myAverageRating ?? "-"} avg</span>
              </div>

              <div className={styles.spotList}>
                {myPlaces.length ? (
                  myPlaces.map((spot) => (
                    <button
                      key={spot.key}
                      className={styles.spotItem}
                      onClick={() => setSelectedSpot(spot)}
                      type="button"
                    >
                      <strong>{spot.name}</strong>
                      <span>{spot.address || "No address listed"}</span>
                      <span>
                        {spot.rating.toFixed(1)}/5 · {spot.reviewCount}{" "}
                        {spot.reviewCount === 1 ? "rating" : "ratings"} ·{" "}
                        {spot.beerType || "No style yet"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.empty}>You have not added any beer spots yet.</p>
                )}
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
