/** אריזת קבצים מהספרייה ל-ZIP בצד הדפדפן. */
export type BundleItem = {
  id: string;
  title: string;
  file_name: string;
  url: string | null;
  text: string;
};

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 100) || "file";
}

export async function downloadResourcesZip(items: BundleItem[], zipName = "חומרי-הוראה.zip") {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const item of items) {
    let name = safeName(item.file_name);
    let i = 2;
    while (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)}-${i}${name.slice(dot)}` : `${name}-${i}`;
      i++;
    }
    used.add(name);
    if (item.url) {
      try {
        const res = await fetch(item.url);
        if (!res.ok) continue;
        zip.file(name, await res.blob());
        added++;
      } catch {
        /* skip unreachable file */
      }
    } else if (item.text.trim()) {
      zip.file(name.endsWith(".txt") ? name : `${safeName(item.title)}.txt`, item.text);
      added++;
    }
  }

  if (added === 0) return 0;
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return added;
}
