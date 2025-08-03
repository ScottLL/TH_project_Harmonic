import "./App.css";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { IconButton } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useEffect, useState } from "react";
import CompanyTable from "./components/CompanyTable";
import CreateCollectionModal from "./components/CreateCollectionModal";
import { getCollectionsMetadata, ICollection } from "./utils/jam-api";
import useApi from "./utils/useApi";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // Load collections
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoadingCollections(true);
      const data = await getCollectionsMetadata();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  useEffect(() => {
    // Only auto-select the first collection if no collection is currently selected
    if (!selectedCollectionId && collections?.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    if (selectedCollectionId) {
      window.history.pushState({}, "", `?collection=${selectedCollectionId}`);
    }
  }, [selectedCollectionId]);

  const handleCreateCollection = async (newCollection: { id: string; collection_name: string }) => {
    // Refresh collections list and select the new collection
    await loadCollections();
    setSelectedCollectionId(newCollection.id);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="mx-8">
        <div className="font-bold text-xl border-b p-2 mb-4 text-left">
          Harmonic Jam
        </div>
        <div className="flex">
          <div className="w-1/5">
            <div className="flex items-center justify-between border-b mb-2 pb-2">
              <p className="font-bold text-left">Collections</p>
              <IconButton 
                size="small" 
                onClick={() => setShowCreateModal(true)}
                title="Add new collection"
                style={{ color: 'white' }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </div>
            <div className="flex flex-col gap-2 text-left">
              {loadingCollections ? (
                <p className="text-gray-400 pl-4">Loading...</p>
              ) : (
                collections?.map((collection) => {
                  return (
                    <div
                      key={collection.id}
                      className={`py-1 pl-4 hover:cursor-pointer hover:bg-orange-300 ${
                        selectedCollectionId === collection.id &&
                        "bg-orange-500 font-bold"
                      }`}
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                      }}
                    >
                      {collection.collection_name}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="w-4/5 ml-4">
            {selectedCollectionId && (
              <CompanyTable selectedCollectionId={selectedCollectionId} />
            )}
          </div>
        </div>

        {/* Create Collection Modal */}
        <CreateCollectionModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateCollection}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
