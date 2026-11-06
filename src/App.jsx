import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import pdfUrl from "./assets/psdVISHALpd.pdf";

import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function App() {
  const viewerRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    let pdfDocument;
    let cancelled = false;
    let renderId = 0;
    let resizeTimer;
    let renderTasks = [];

    const renderPages = async () => {
      if (!pdfDocument || !viewer) return;

      const currentRenderId = ++renderId;
      renderTasks.forEach((task) => task.cancel());
      renderTasks = [];
      viewer.replaceChildren();

      const availableWidth = Math.max(1, viewer.clientWidth - 24);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      for (
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber += 1
      ) {
        if (cancelled || currentRenderId !== renderId) return;

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled || currentRenderId !== renderId) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Unable to render the PDF page.");

        canvas.className = "pdf-page-canvas";
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Page ${pageNumber}`);

        const pageContainer = document.createElement("div");
        pageContainer.className = "pdf-page";
        pageContainer.appendChild(canvas);
        viewer.appendChild(pageContainer);

        const renderTask = page.render({
          canvasContext: context,
          viewport: page.getViewport({ scale: scale * pixelRatio }),
        });
        renderTasks.push(renderTask);

        try {
          await renderTask.promise;
        } catch (error) {
          if (cancelled || currentRenderId !== renderId) return;
          throw error;
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        renderPages().catch((error) => {
          console.error("Unable to render PDF pages:", error);
          setHasError(true);
        });
      }, 120);
    });

    if (viewer) resizeObserver.observe(viewer);

    loadingTask.promise
      .then((document) => {
        if (cancelled) {
          document.destroy();
          return;
        }
        pdfDocument = document;
        return renderPages();
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Unable to load PDF:", error);
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      renderTasks.forEach((task) => task.cancel());
      loadingTask.destroy();
      pdfDocument?.destroy();
    };
  }, []);

  return (
    <main className="document-page" aria-label="PDF document">
      {hasError ? (
        <p className="document-error" role="alert">
          The document could not be displayed.
        </p>
      ) : (
        <div className="document-viewer" ref={viewerRef} />
      )}
    </main>
  );
}

export default App;
