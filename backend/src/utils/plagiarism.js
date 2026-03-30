// Plagiarism Detection Pipeline
// 1. Remove comments
// 2. Normalize variables -> VAR
// 3. Replace numbers -> NUM
// 4. Tokenize
// 5. Generate k-grams (k=3)
// 6. Compute Jaccard similarity

function preprocessCode(code) {
    if (!code) return "";
    
    // 1. Remove comments (// and /* */)
    let processed = code.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');
    
    // 2. Normalize variables (Basic regex for let/const/var)
    processed = processed.replace(/\b(let|const|var)\s+([a-zA-Z_]\w*)\b/g, '$1 VAR');
    processed = processed.replace(/\bfunction\s+([a-zA-Z_]\w*)\b/g, 'function VAR');

    // 3. Replace numbers -> NUM
    processed = processed.replace(/\b\d+(\.\d+)?\b/g, 'NUM');

    // Remove string literals to reduce noise
    processed = processed.replace(/(["'`]).*?\1/g, 'STR');

    // 4. Tokenize
    const tokens = processed.match(/\w+|[^\w\s]/g) || [];
    return tokens;
}

function generateKGrams(tokens, k = 3) {
    const kGrams = new Set();
    for (let i = 0; i <= tokens.length - k; i++) {
        const gram = tokens.slice(i, i + k).join('');
        kGrams.add(gram);
    }
    return kGrams;
}

function computeJaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0) return 0;
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

exports.calculateSimilarity = (code1, code2) => {
    const tokens1 = preprocessCode(code1);
    const tokens2 = preprocessCode(code2);
    
    const kGrams1 = generateKGrams(tokens1);
    const kGrams2 = generateKGrams(tokens2);
    
    return computeJaccardSimilarity(kGrams1, kGrams2);
};
