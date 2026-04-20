"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type ViewMode = "map" | "mypage";

type Props = {
  initialSpots: BeerSpot[];
};

export function BeerMapScreen({ initialSpots }: Props) {
  const { data: session, status } = useSession();
  const [authAction, setAuthAction] = useState<"signin" | "signout" | null>(null);
  const [spots, setSpots] = useState(initialSpots);
  const [selectedSpot, setSelectedSpot] = useState<BeerSpot | null>(null);
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
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(
    null
  );

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries
  });

  const averageRating = useMemo(() => {
    if (!spots.length) {
      return null;
    }

    const total = spots.reduce((sum, spot) => sum + spot.rating, 0);
    return (total / spots.length).toFixed(1);
  }, [spots]);

  const canCreate = Boolean(session?.user?.email && session?.user?.name);
  const mySpots = useMemo(
    () => spots.filter((spot) => spot.userEmail === session?.user?.email),
    [session?.user?.email, spots]
  );
  const myAverageRating = useMemo(() => {
    if (!mySpots.length) {
      return null;
    }

    const total = mySpots.reduce((sum, spot) => sum + spot.rating, 0);
    return (total / mySpots.length).toFixed(1);
  }, [mySpots]);
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
    if (!myMapRef.current || !mySpots.length || viewMode !== "mypage") {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    mySpots.forEach((spot) => {
      bounds.extend({ lat: spot.lat, lng: spot.lng });
    });
    myMapRef.current.fitBounds(bounds);
  }, [mySpots, viewMode]);

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

    if (selectedSpot?.id === id) {
      setSelectedSpot(null);
    }

    await refreshSpots();
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
              <strong>{spots.length}</strong>
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
                {spots.map((spot) => (
                  <MarkerF
                    key={spot.id}
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
                    <div className={styles.infoWindow}>
                      <h3>{selectedSpot.name}</h3>
                      <p>{selectedSpot.address || "No address listed"}</p>
                      <p>{selectedSpot.description}</p>
                      <p>Beer Style: {selectedSpot.beerType || "Not added"}</p>
                      <p>Rating: {selectedSpot.rating.toFixed(1)}/5</p>
                      <p>Added by: {selectedSpot.submittedBy || "Anonymous"}</p>
                      {selectedSpot.userEmail === session?.user?.email ? (
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(selectedSpot.id)}
                          type="button"
                        >
                          Delete Pin
                        </button>
                      ) : null}
                    </div>
                  </InfoWindowF>
                ) : null}
              </GoogleMap>
            </section>

            <aside className={styles.sideStack}>
              <section className={styles.formPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Create</p>
                    <h2>Add a New Pin</h2>
                  </div>
                  <span className={styles.inlineBadge}>
                    {session?.user?.name ?? "Sign in required"}
                  </span>
                </div>

                <form className={styles.formCard} onSubmit={handleSubmit}>
                  <label>
                    Place Name
                    <input
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
                    Why do you like it?
                    <textarea
                      required
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

                  <div className={styles.fieldRow}>
                    <label>
                      Beer Style
                      <input
                        value={form.beerType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            beerType: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label>
                      Rating
                      <input
                        max={5}
                        min={0.5}
                        step={0.5}
                        type="number"
                        value={form.rating}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            rating: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                  </div>

                  {session?.user?.name ? (
                    <p className={styles.helperText}>
                      Pin will be saved as {session.user.name}.
                    </p>
                  ) : (
                    <p className={styles.helperText}>
                      Sign in to save pins with your Google name.
                    </p>
                  )}

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
                  {spots.length ? (
                    spots.map((spot) => (
                      <button
                        key={spot.id}
                        className={styles.spotItem}
                        onClick={() => setSelectedSpot(spot)}
                        type="button"
                      >
                        <strong>{spot.name}</strong>
                        <span>{spot.address || "No address listed"}</span>
                        <span>
                          {spot.rating.toFixed(1)}/5 · {spot.submittedBy || "Anonymous"} ·{" "}
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
                <span className={styles.inlineBadge}>{mySpots.length} saved</span>
              </div>

              <GoogleMap
                center={mySpots[0] ? { lat: mySpots[0].lat, lng: mySpots[0].lng } : defaultCenter}
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
                {mySpots.map((spot) => (
                  <MarkerF
                    key={spot.id}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    onClick={() => setSelectedSpot(spot)}
                  />
                ))}

                {selectedSpot ? (
                  <InfoWindowF
                    position={{ lat: selectedSpot.lat, lng: selectedSpot.lng }}
                    onCloseClick={() => setSelectedSpot(null)}
                  >
                    <div className={styles.infoWindow}>
                      <h3>{selectedSpot.name}</h3>
                      <p>{selectedSpot.address || "No address listed"}</p>
                      <p>{selectedSpot.description}</p>
                      <p>Beer Style: {selectedSpot.beerType || "Not added"}</p>
                      <p>Rating: {selectedSpot.rating.toFixed(1)}/5</p>
                      {selectedSpot.userEmail === session?.user?.email ? (
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(selectedSpot.id)}
                          type="button"
                        >
                          Delete Pin
                        </button>
                      ) : null}
                    </div>
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
                {mySpots.length ? (
                  mySpots.map((spot) => (
                    <button
                      key={spot.id}
                      className={styles.spotItem}
                      onClick={() => setSelectedSpot(spot)}
                      type="button"
                    >
                      <strong>{spot.name}</strong>
                      <span>{spot.address || "No address listed"}</span>
                      <span>
                        {spot.rating.toFixed(1)}/5 · {spot.beerType || "No style yet"}
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
