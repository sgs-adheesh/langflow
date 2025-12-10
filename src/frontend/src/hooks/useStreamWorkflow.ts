/**
 * Custom hook for streaming workflow creation with progressive animation
 * Displays nodes and edges one by one with smooth animations
 */

import { useCallback } from "react";
import useFlowStore from "@/stores/flowStore";
import { AllNodeType, EdgeType } from "@/types/flow";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";

export interface StreamWorkflowOptions {
  /** Delay between each node/edge in milliseconds */
  delay?: number;
  /** Whether to animate nodes */
  animateNodes?: boolean;
  /** Whether to animate edges */
  animateEdges?: boolean;
  /** Whether to dynamically adjust viewport as nodes stream in */
  dynamicViewport?: boolean;
}

const DEFAULT_OPTIONS: StreamWorkflowOptions = {
  delay: 900, // 300ms between each item
  animateNodes: true,
  animateEdges: true,
  dynamicViewport: true, // Enable progressive viewport adjustments
};

export const useStreamWorkflow = () => {
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const reactFlowInstance = useFlowStore((state) => state.reactFlowInstance);
  const setIsStreaming = useFlowStore((state) => state.setIsStreaming);

  /**
   * Calculate optimal viewport to fit all nodes
   */
  const calculateViewport = (nodes: AllNodeType[]) => {
    if (!reactFlowInstance || nodes.length === 0) return null;
    
    try {
      // Get bounds of all nodes
      const bounds = getNodesBounds(nodes);
      
      // Get the ReactFlow wrapper dimensions
      const width = reactFlowInstance.getViewport().zoom * window.innerWidth;
      const height = reactFlowInstance.getViewport().zoom * window.innerHeight;
      
      // Calculate viewport to fit bounds
      const viewport = getViewportForBounds(
        bounds,
        width,
        height,
        0.05,  // minZoom - allow extreme zoom out
        1.5,   // maxZoom - allow zoom in for small workflows
        0.1    // padding - 10% around edges
      );
      
      return viewport;
    } catch (error) {
      console.warn("Failed to calculate viewport:", error);
      return null;
    }
  };

  /**
   * Stream workflow data progressively
   * Shows nodes first, then edges, with smooth animations
   */
  const streamWorkflow = useCallback(
    async (
      nodes: AllNodeType[],
      edges: EdgeType[],
      options: StreamWorkflowOptions = {}
    ) => {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      // Set streaming flag to prevent ReactFlow's auto-fitView
      setIsStreaming(true);

      // Clear canvas first
      setNodes([]);
      setEdges([]);

      // Wait a moment for canvas to clear
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Only pre-calculate viewport if dynamic viewport is disabled
      if (!opts.dynamicViewport) {
        const viewport = calculateViewport(nodes);
        if (viewport && reactFlowInstance) {
          // Set viewport instantly to show where nodes will appear
          reactFlowInstance.setViewport({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
          }, { duration: 600 }); // Smooth 600ms zoom animation
          
          // Wait for zoom animation to complete
          await new Promise((resolve) => setTimeout(resolve, 700));
        } else {
          // Fallback: just wait a bit
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } else {
        // For dynamic viewport, start with a reasonable initial zoom
        if (reactFlowInstance) {
          reactFlowInstance.setViewport({
            x: 100,
            y: 100,
            zoom: 0.8,
          }, { duration: 0 });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Stream nodes one by one
      if (opts.animateNodes) {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          
          // Mark node as animated for CSS animation
          const animatedNode = {
            ...node,
            data: {
              ...node.data,
              animated: true,
            },
          };

          // Add node to canvas
          setNodes((prevNodes) => [...prevNodes, animatedNode as AllNodeType]);

          // Dynamically adjust viewport to keep new nodes visible
          if (opts.dynamicViewport && reactFlowInstance) {
            // Wait a bit for the node to be rendered in DOM
            await new Promise((resolve) => setTimeout(resolve, 50));
            
            // Get all currently visible nodes (up to index i)
            const currentNodes = nodes.slice(0, i + 1);
            
            // Smoothly adjust viewport to fit current nodes
            const currentViewport = calculateViewport(currentNodes);
            if (currentViewport) {
              reactFlowInstance.setViewport({
                x: currentViewport.x,
                y: currentViewport.y,
                zoom: currentViewport.zoom,
              }, { duration: 300 }); // Quick smooth adjustment
            }
          }

          // Wait before next node
          if (i < nodes.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, opts.delay));
          }
        }

        // Extra delay after all nodes before edges
        await new Promise((resolve) => setTimeout(resolve, opts.delay! * 1.5));
      } else {
        // Add all nodes at once
        setNodes(nodes);
      }

      // Stream edges one by one
      if (opts.animateEdges) {
        for (let i = 0; i < edges.length; i++) {
          const edge = edges[i];
          
          // Mark edge as animated
          const animatedEdge = {
            ...edge,
            animated: true,
            data: {
              ...edge.data,
              streamAnimated: true,
            },
          };

          // Add edge to canvas
          setEdges((prevEdges) => [...prevEdges, animatedEdge as EdgeType]);

          // Wait before next edge
          if (i < edges.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, opts.delay! * 0.7)); // Edges appear faster
          }
        }

        // After streaming is complete, remove animated flags
        setTimeout(() => {
          setNodes((nodes) =>
            nodes.map((node) => ({
              ...node,
              data: {
                ...node.data,
                animated: false,
              },
            }))
          );
          setEdges((edges) =>
            edges.map((edge) => {
              if (!edge.data) return edge;
              return {
                ...edge,
                animated: false,
                data: {
                  sourceHandle: edge.data.sourceHandle,
                  targetHandle: edge.data.targetHandle,
                  streamAnimated: false,
                },
              };
            })
          );
          
          // Final fit-to-screen after streaming completes
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView({
                padding: 0.1,     // 10% padding
                duration: 400,    // Smooth 400ms animation
                minZoom: 0.05,    // Allow extreme zoom out
                maxZoom: 1.5,     // Allow zoom in for small workflows
              });
            }
          }, 100); // Small delay to ensure all nodes are rendered
          
          // Re-enable auto-fitView after final fit completes
          setTimeout(() => {
            setIsStreaming(false);
          }, 600); // Wait for fitView animation to complete (400ms + 200ms buffer)
        }, 1000);
      } else {
        // Add all edges at once
        setEdges(edges);
      }
    },
    [setNodes, setEdges, reactFlowInstance, setIsStreaming]
  );

  return { streamWorkflow };
};
