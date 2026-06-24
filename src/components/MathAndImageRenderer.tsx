import React from 'react';
import katex from 'katex';

interface MathAndImageRendererProps {
  text?: string;
  image?: string;
  imageMaxHeight?: string;
  className?: string;
}

export function MathAndImageRenderer({ text, image, imageMaxHeight = "max-h-72", className = "" }: MathAndImageRendererProps) {
  if (!text && !image) return null;

  // Safe formatting helper to render beautiful math formulas using KaTeX
  const renderLaTeXText = (rawText: string) => {
    if (!rawText) return null;

    // Fix and sanitize any broken control characters or stripped backslashes in LaTeX formulas
    const normalizedText = rawText
      .replace(/\x0c/g, '\\f') // Convert Form Feed character back to \f (especially inside \frac)
      .replace(/\x08/g, '\\b') // Convert Backspace back to \b (especially inside \beta, \begin)
      .replace(/\v/g, '\\v')   // Convert Vertical Tab back to \v (especially inside \vec)
      .replace(/\\rac\{/g, '\\frac{') // Fix \rac{ -> \frac{
      .replace(/([^fdt]|^)rac\{/g, '$1\\frac{') // Fix rac{ (without prepended f/d/t) -> \frac{
      .replace(/([^\\fdt]|^)dfrac\{/g, '$1\\dfrac{')
      .replace(/([^\\fdt]|^)tfrac\{/g, '$1\\tfrac{');

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Match display math $$...$$ and inline math $...$
    const regex = /\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/g;
    let match;

    while ((match = regex.exec(normalizedText)) !== null) {
      const matchIndex = match.index;
      // Add text before the match
      if (matchIndex > currentIndex) {
        parts.push(<span key={`text-${currentIndex}`}>{normalizedText.slice(currentIndex, matchIndex)}</span>);
      }

      const displayMath = match[1];
      const inlineMath = match[2];

      if (displayMath) {
        try {
          const html = katex.renderToString(displayMath, { displayMode: true, throwOnError: false });
          parts.push(
            <div 
              key={`math-disp-${matchIndex}`} 
              dangerouslySetInnerHTML={{ __html: html }} 
              className="my-2 overflow-x-auto py-1 scrollbar-thin" 
            />
          );
        } catch (e) {
          parts.push(<span key={`math-err-${matchIndex}`} className="text-red-500 font-mono">{displayMath}</span>);
        }
      } else if (inlineMath) {
        try {
          const html = katex.renderToString(inlineMath, { displayMode: false, throwOnError: false });
          parts.push(
            <span 
              key={`math-inline-${matchIndex}`} 
              dangerouslySetInnerHTML={{ __html: html }} 
              className="inline-block mx-1 font-semibold" 
            />
          );
        } catch (e) {
          parts.push(<span key={`math-err-${matchIndex}`} className="text-red-500 font-mono">{inlineMath}</span>);
        }
      }

      currentIndex = regex.lastIndex;
    }

    if (currentIndex < normalizedText.length) {
      parts.push(<span key="text-end">{normalizedText.slice(currentIndex)}</span>);
    }

    return (
      <div className="whitespace-pre-line leading-relaxed text-slate-800 text-sm md:text-base">
        {parts.length > 0 ? parts : rawText}
      </div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {text && (
        <div className="selection:bg-indigo-100">
          {renderLaTeXText(text)}
        </div>
      )}
      
      {image && (
        <div className="flex flex-col items-center justify-center my-3 max-w-full">
          <div className="relative group overflow-hidden border border-slate-200 bg-white p-2 text-center rounded-xl shadow-xs transition hover:shadow-md">
            <img 
              src={image} 
              alt="Công thức toán học hoặc đồ thị thám hiểm" 
              className={`object-contain rounded-lg ${imageMaxHeight} select-none max-w-full`}
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white px-2 py-0.5 text-[9px] rounded-full font-sans uppercase tracking-widest font-semibold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              Đồ thị / Công thức Trạm thi
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

