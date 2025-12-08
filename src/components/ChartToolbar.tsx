import React from "react";
import PositionsSection from "./PositionsSection";

interface ChartToolbarProps {
  selectedPair: string | undefined;
}

export const ChartToolbar = ({ selectedPair }: ChartToolbarProps) => {
  void selectedPair;

  return (
    <div
      className="
        h-full w-full
        bg-chart-bg
        overflow-y-auto
        overflow-x-hidden
      "
    >
      {/* 
        Wrapper qui force la largeur à celle du chart
        et annule les marges/largeurs de la racine de PositionsSection
      */}
      <div
        className="
          w-full max-w-full overflow-x-hidden 
          [&>*]:w-full 
          [&>*]:ml-0 
          [&>*]:mr-0
        "
      >
        <PositionsSection />
      </div>
    </div>
  );
};
