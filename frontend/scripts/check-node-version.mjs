const minMajor = 20;
const maxMajorExclusive = 23;
const recommendedMajor = 22;
const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);

if (!Number.isFinite(major) || major < minMajor || major >= maxMajorExclusive) {
  console.error(
    `[directstock-frontend] Unsupported Node.js ${process.version}. ` +
      `Use Node ${recommendedMajor} LTS (supported range: >=${minMajor} <${maxMajorExclusive}).`
  );
  process.exit(1);
}
