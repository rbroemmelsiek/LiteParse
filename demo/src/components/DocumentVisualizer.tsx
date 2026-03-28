"use client";

import React, { useState } from 'react';
import { UploadCloud, File as FileIcon, Loader2, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageData {
  page: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  image: string;
  textItems: TextItem[];
}

export default function DocumentVisualizer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pages, setPages] = useState<PageData[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [hoveredText, setHoveredText] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setPages([]);
    setAnalysis(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.pages) {
        setPages(data.pages);
        
        // Trigger Analysis
        if (data.text) {
          setAnalyzing(true);
          try {
            const aiRes = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: data.text }),
            });
            const aiData = await aiRes.json();
            if (aiData.analysis) {
              setAnalysis(aiData.analysis);
            } else if (aiData.error) {
              setAnalysis(`**Gemini API Error:** ${aiData.error}`);
            }
          } catch (err) {
            setAnalysis('**Error communicating with Gemini API.**');
          } finally {
            setAnalyzing(false);
          }
        }
      } else {
        alert(data.error || "Failed to parse document");
      }
    } catch (err) {
      alert("Error parsing document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
    setAnalysis(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-neutral-200">
      {/* Upload Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-neutral-900 border-b border-neutral-800 shrink-0 shadow-lg z-10">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">LiteParse Studio</h1>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          {pages.length > 0 && (
            <button
              onClick={handleReset}
              className="mr-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors font-medium shadow-lg"
            >
              Upload New Document
            </button>
          )}
          {hoveredText && (
            <div className="bg-neutral-800 text-sm py-1 px-3 rounded-md max-w-sm truncate border border-neutral-700">
              <span className="text-neutral-400 mr-2">Hover:</span> {hoveredText}
            </div>
          )}
          <button 
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-neutral-400 font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-[#0a0a0c]">
        {pages.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center p-8">
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 w-full max-w-2xl
                ${file ? 'border-indigo-500 bg-indigo-500/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-900/50'}
              `}
            >
              <UploadCloud className="w-16 h-16 mx-auto mb-4 text-neutral-400" />
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your PDF</h3>
              <p className="text-neutral-500 mb-6 font-light">or click to browse local files</p>
              
              <input 
                type="file" 
                accept=".pdf,.docx,.png,.jpg" 
                className="hidden" 
                id="file-upload"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              
              <div className="flex items-center justify-center space-x-4">
                <label 
                  htmlFor="file-upload" 
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors shadow-md"
                >
                  Select File
                </label>
                {file && (
                  <button 
                    onClick={handleProcess}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors font-medium shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileIcon className="w-5 h-5 mr-2" />}
                    {loading ? 'Processing...' : 'Analyze Document'}
                  </button>
                )}
              </div>
              
              {file && (
                <div className="mt-8 text-sm text-indigo-300 bg-indigo-950/30 inline-flex items-center px-4 py-2 rounded-full">
                  <FileIcon className="w-4 h-4 mr-2" />
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Left Box: PDF Render */}
            <div className="flex-1 overflow-auto p-8 pb-32 flex flex-col items-center">
              <div className="flex flex-col space-y-12 items-center w-full">
                {pages.map((p, i) => {
                  const scaleX = 100 / p.width;
                  const scaleY = 100 / p.height;
                  
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className="text-sm text-neutral-500 mb-3 tracking-widest uppercase">Page {p.page}</div>
                      
                      <div 
                        className="relative bg-white shadow-2xl overflow-hidden ring-1 ring-white/10"
                        style={{ 
                          width: p.imageWidth * zoom, 
                          height: p.imageHeight * zoom 
                        }}
                      >
                        <img 
                          src={p.image} 
                          alt={`Page ${p.page}`} 
                          className="absolute inset-0 w-full h-full pointer-events-none" 
                        />
                        
                        <div className="absolute inset-0 w-full h-full pointer-events-none origin-top-left">
                          {p.textItems.map((item, idx) => {
                            const left = item.x * scaleX;
                            const top = item.y * scaleY;
                            const width = item.width * scaleX;
                            const height = item.height * scaleY;
                            
                            return (
                              <div 
                                key={idx}
                                onMouseEnter={() => setHoveredText(item.text)}
                                onMouseLeave={() => setHoveredText(null)}
                                className="absolute border border-indigo-500/40 bg-indigo-400/10 hover:bg-orange-400/40 hover:border-orange-500 transition-colors pointer-events-auto cursor-crosshair rounded-sm"
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                }}
                              >
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Box: Gemini Analysis */}
            <div className="w-1/3 min-w-[350px] max-w-lg border-l border-neutral-800 bg-neutral-900/40 p-6 flex flex-col shadow-2xl">
              <div className="flex items-center text-indigo-400 mb-6 pb-4 border-b border-neutral-800">
                <Sparkles className="w-5 h-5 mr-3" />
                <h2 className="text-xl font-semibold">Gemini AI Analysis</h2>
              </div>
              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center h-48 text-neutral-500 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="animate-pulse">Analyzing document text...</span>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-invert prose-p:text-neutral-300 max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mb-4 leading-tight" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-indigo-300 mt-6 mb-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-medium text-indigo-200 mt-5 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="text-neutral-300 leading-relaxed mb-4 text-sm md:text-base" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 mb-4 text-neutral-300 text-sm md:text-base" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-neutral-500 italic text-sm text-center mt-12">
                    Upload a document and Gemini will summarize it here.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
