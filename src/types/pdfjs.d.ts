declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/build/pdf' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const workerSrc: string;
  export default workerSrc;
}

declare module '*?url' {
  const value: string;
  export default value;
}
