import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface SpaceObject {
  id: string;
  type: "satellite" | "debris";
  pos: { x: number; y: number; z: number };
}

interface Props {
  objects: SpaceObject[];
}

export const WorldMap: React.FC<Props> = ({ objects }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll("*").remove();

    const projection = d3.geoEquirectangular()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Draw Map
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data: any) => {
      svg.append("g")
        .selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#1e293b")
        .attr("stroke", "#334155");

      // Draw Objects
      const satData = objects.filter(o => o.type === 'satellite');
      
      svg.append("g")
        .selectAll("circle")
        .data(satData)
        .enter()
        .append("circle")
        .attr("cx", (d: any) => {
          if (!d.pos) return 0;
          const lon = Math.atan2(d.pos.y, d.pos.x) * (180 / Math.PI);
          return projection([lon, 0])![0];
        })
        .attr("cy", (d: any) => {
          if (!d.pos) return 0;
          const lat = Math.asin(d.pos.z / Math.sqrt(d.pos.x**2 + d.pos.y**2 + d.pos.z**2)) * (180 / Math.PI);
          return projection([0, lat])![1];
        })
        .attr("r", 3)
        .attr("fill", "#22c55e")
        .attr("opacity", 0.8);
    });
  }, [objects]);

  return <svg ref={svgRef} className="w-full h-full bg-slate-900 rounded-xl border border-slate-800" />;
};
