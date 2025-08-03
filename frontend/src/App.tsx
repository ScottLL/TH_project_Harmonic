import "./App.css";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useEffect, useState } from "react";
import CompanyTable from "./components/CompanyTable";
import CreateCollectionModal from "./components/CreateCollectionModal";
import DraggableCollections from "./components/DraggableCollections";
import { getCollectionsMetadata, deleteCollection, ICollection } from "./utils/jam-api";
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
  const [collectionOrder, setCollectionOrder] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<{id: string, name: string} | null>(null);

  // Load collections
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoadingCollections(true);
      const data = await getCollectionsMetadata();
      setCollections(data);
      
      // Load saved order from localStorage
      const savedOrder = localStorage.getItem('collectionOrder');
      if (savedOrder) {
        setCollectionOrder(JSON.parse(savedOrder));
      }
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

  const handleReorderCollections = (reorderedCollections: ICollection[]) => {
    const newOrder = reorderedCollections.map(col => col.id);
    setCollectionOrder(newOrder);
    
    // Save to localStorage
    localStorage.setItem('collectionOrder', JSON.stringify(newOrder));
  };

  const getOrderedCollections = (): ICollection[] => {
    if (collectionOrder.length === 0) {
      return collections;
    }

    // Sort collections based on saved order
    const orderedCollections = [...collections].sort((a, b) => {
      const aIndex = collectionOrder.indexOf(a.id);
      const bIndex = collectionOrder.indexOf(b.id);
      
      // If both items are in the order array, use their positions
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one item is in the order array, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither item is in the order array, maintain original order
      return 0;
    });

    return orderedCollections;
  };

  const handleDeleteCollection = (id: string, name: string) => {
    setCollectionToDelete({ id, name });
    setShowDeleteDialog(true);
  };

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete) return;

    try {
      await deleteCollection(collectionToDelete.id);
      
      // If the deleted collection was selected, switch to the first available collection
      if (selectedCollectionId === collectionToDelete.id) {
        const remainingCollections = collections.filter(c => c.id !== collectionToDelete.id);
        if (remainingCollections.length > 0) {
          setSelectedCollectionId(remainingCollections[0].id);
        } else {
          setSelectedCollectionId(undefined);
        }
      }
      
      // Refresh the collections list
      await loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      // You might want to show an error message to the user here
    } finally {
      setShowDeleteDialog(false);
      setCollectionToDelete(null);
    }
  };

  const cancelDeleteCollection = () => {
    setShowDeleteDialog(false);
    setCollectionToDelete(null);
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
            {loadingCollections ? (
              <div className="flex flex-col gap-2 text-left">
                <p className="text-gray-400 pl-4">Loading...</p>
              </div>
            ) : (
              <DraggableCollections
                collections={getOrderedCollections()}
                selectedCollectionId={selectedCollectionId}
                onSelectCollection={setSelectedCollectionId}
                onReorderCollections={handleReorderCollections}
                onDeleteCollection={handleDeleteCollection}
              />
            )}
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

        {/* Delete Collection Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onClose={cancelDeleteCollection} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Collection</DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              Are you sure you want to delete the collection "{collectionToDelete?.name}"?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This action cannot be undone. All companies in this collection will be removed.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDeleteCollection} color="inherit">
              Cancel
            </Button>
            <Button onClick={confirmDeleteCollection} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

export default App;
