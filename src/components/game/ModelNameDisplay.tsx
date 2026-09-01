import React, { useState } from "react";

interface ModelNameDisplayProps {
  modelName: string;
}

/**
 * Displays the model name; long names are truncated and expandable.
 */
const ModelNameDisplay: React.FC<ModelNameDisplayProps> = ({ modelName }) => {
  const [showFull, setShowFull] = useState(false);

  if (modelName.length <= 25) {
    return <>{modelName}</>;
  }
  return (
    <button
      type="button"
      onClick={() => setShowFull(!showFull)}
      style={{ font: "inherit", color: "inherit" }}
      className="inline-block cursor-pointer border-none bg-transparent p-0 underline decoration-dotted underline-offset-2 transition-colors hover:text-lime-600 focus:outline-none dark:hover:text-lime-400"
      title={showFull ? "Click to collapse" : "Click to show full model name"}
    >
      {showFull ? modelName : `${modelName.substring(0, 22)}...`}
    </button>
  );
};

export default ModelNameDisplay;
