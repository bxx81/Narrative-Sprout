import React, { useState } from "react";
import { truncateText } from "../../lib/truncateText";

interface ModelNameDisplayProps {
  modelName: string;
}

const MODEL_NAME_FULL_MAX_LENGTH = 25;
const MODEL_NAME_TRUNCATED_MAX_LENGTH = 22;

/**
 * Displays the model name; long names are truncated and expandable.
 */
const ModelNameDisplay: React.FC<ModelNameDisplayProps> = ({ modelName }) => {
  const [showFull, setShowFull] = useState(false);

  if (Array.from(modelName).length <= MODEL_NAME_FULL_MAX_LENGTH) {
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
      {showFull ? modelName : truncateText(modelName, MODEL_NAME_TRUNCATED_MAX_LENGTH)}
    </button>
  );
};

export default ModelNameDisplay;
