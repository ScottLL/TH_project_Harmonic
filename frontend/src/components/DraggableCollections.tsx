import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragIndicator } from '@mui/icons-material';
import { ICollection } from '../utils/jam-api';

interface SortableCollectionItemProps {
  collection: ICollection;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function SortableCollectionItem({ collection, isSelected, onSelect }: SortableCollectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center py-1 hover:bg-orange-300 ${
        isSelected ? 'bg-orange-500 font-bold' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-6 h-6 ml-1 mr-1 cursor-grab hover:bg-gray-600 rounded"
        title="Drag to reorder"
      >
        <DragIndicator fontSize="small" className="text-gray-400" />
      </div>
      <div
        className="flex-1 pl-2 hover:cursor-pointer"
        onClick={() => onSelect(collection.id)}
      >
        {collection.collection_name}
      </div>
    </div>
  );
}

interface DraggableCollectionsProps {
  collections: ICollection[];
  selectedCollectionId?: string;
  onSelectCollection: (id: string) => void;
  onReorderCollections: (collections: ICollection[]) => void;
}

function DraggableCollections({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onReorderCollections,
}: DraggableCollectionsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = collections.findIndex((item) => item.id === active.id);
      const newIndex = collections.findIndex((item) => item.id === over.id);

      const reorderedCollections = arrayMove(collections, oldIndex, newIndex);
      onReorderCollections(reorderedCollections);
    }
  };

  // Separate "My List" from other collections
  const myListCollection = collections.find(col => col.collection_name === "My List");
  const otherCollections = collections.filter(col => col.collection_name !== "My List");

  return (
    <div className="flex flex-col gap-2 text-left">
      {/* Always show "My List" first, not draggable */}
      {myListCollection && (
        <div
          className={`py-1 pl-4 hover:cursor-pointer hover:bg-orange-300 ${
            selectedCollectionId === myListCollection.id ? 'bg-orange-500 font-bold' : ''
          }`}
          onClick={() => onSelectCollection(myListCollection.id)}
        >
          {myListCollection.collection_name}
        </div>
      )}

      {/* Draggable other collections */}
      {otherCollections.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={otherCollections.map(col => col.id)}
            strategy={verticalListSortingStrategy}
          >
            {otherCollections.map((collection) => (
              <SortableCollectionItem
                key={collection.id}
                collection={collection}
                isSelected={selectedCollectionId === collection.id}
                onSelect={onSelectCollection}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export default DraggableCollections;