'use client'

export default function myImageLoader({ src, width, quality }) {
  if (quality) {
    return `${src}?quality=${quality}&width=${width}`;
  } else return `${src}?width=${width}`;
}