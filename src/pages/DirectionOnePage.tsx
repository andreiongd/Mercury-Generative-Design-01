import { SeededSketchPage } from "../components/SeededSketchPage";
import directionOneSeedData from "../sketch/directionOneSeedData.json";

type DirectionOnePageProps = {
  onNavigate: () => void;
};

const MAIN_VASE_IMAGES = [
  "/sketch-images/vases/vase06.png",
  "/sketch-images/vases/vase04.png",
  "/sketch-images/vases/vase05.png",
];
const DIRECTION_ONE_PRESET_VARIABLES = directionOneSeedData.map((item) => item.variables);

export function DirectionOnePage({ onNavigate }: DirectionOnePageProps) {
  return (
    <SeededSketchPage
      title="Direction 1"
      presetVariables={DIRECTION_ONE_PRESET_VARIABLES}
      vaseImages={MAIN_VASE_IMAGES}
      savePrefix="main-dithered-preset"
      navLabel="Open Direction 2"
      onNavigate={onNavigate}
    />
  );
}
