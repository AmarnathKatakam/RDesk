const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "https://deskr.onrender.com";

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path || "";
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const targetUrl = `${BACKEND_ORIGIN}/api/${path}${query.toString() ? `?${query}` : ""}`;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
    duplex: "half",
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}
