declare module '*.svg' {
  const url: string
  export default url
}
declare module '*.png' {
  const url: string
  export default url
}
declare module '*.jpg' {
  const url: string
  export default url
}
declare module '*.jpeg' {
  const url: string
  export default url
}
/** Vite's `?url` suffix: the built URL of a file, e.g. the pdf.js worker. */
declare module '*?url' {
  const url: string
  export default url
}
