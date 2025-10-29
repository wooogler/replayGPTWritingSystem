// components/Replay.tsx
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type CodeMirror from 'codemirror';

interface Props {
  // In case we need to add any props later
}

export interface ReplayHandle {
  getEditor: () => CodeMirror.Editor | null;
  testEditor: () => void;
}

const Replay = forwardRef<ReplayHandle, Props>((props, ref) => {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const cmInstance = useRef<CodeMirror.Editor | null>(null);
  const isInitialized = useRef(false); // Add this flag

  // Send CodeMirror to Page.tsx
  useImperativeHandle(ref, () => ({
    getEditor: () => cmInstance.current,
    testEditor: () => {
        if (cmInstance.current) {
          // console.log("Editor exists!");
          // console.log("Current value:", cmInstance.current.getValue());
          cmInstance.current.setValue("");
          // console.log("After setValue:", cmInstance.current.getValue());
        } else {
          console.error("Editor is null!");
        }
      }
    }));

  useEffect(() => {
  let isMounted = true;
  
  if (typeof window !== 'undefined' && editorRef.current && !cmInstance.current) {
    Promise.all([
      import('codemirror'),
      import('codemirror/mode/javascript/javascript'),
      import('codemirror/lib/codemirror.css'),
      import('codemirror/theme/material.css'),
    ]).then(([CodeMirrorModule]) => {
      if (!isMounted || cmInstance.current) return;
      
      const CM = CodeMirrorModule.default;
     
      cmInstance.current = CM.fromTextArea(editorRef.current!, {
        mode: 'null',
        lineNumbers: false,
        readOnly: true,
        lineWrapping: true,
      });

      // Styling adjustments
      if (cmInstance.current) {
        const wrapper = cmInstance.current.getWrapperElement();
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.border = '1px solid rgb(229, 231, 235)';
        wrapper.style.borderRadius = '0.5rem';
        wrapper.style.fontSize = '20px';

        const scroller = wrapper.querySelector('.CodeMirror-scroll') as HTMLElement;
        if (scroller) {
          scroller.style.maxHeight = '100%';
          scroller.style.overflow = 'auto';
        }
      }
    });
  }

  return () => {
    isMounted = false;
    if (cmInstance.current) {
      cmInstance.current.toTextArea();
      cmInstance.current = null;
    }
  };
}, []);

  return (
    <>
      <h3 className="flex items-center text-[24px] font-semibold text-gray-800 mb-3 pb-3 border-b border-gray-200">
        <svg
          className="w-5 h-5 mr-2 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Editor Replay
      </h3>
      <div className="flex justify-center flex-grow overflow-hidden">
        <textarea
          className="w-full h-full"
          id="editor-play"
          ref={editorRef}
        ></textarea>
      </div>
    </>
  );
});

Replay.displayName = "Replay";
export default Replay;