/**
 * Code Analyzer for Doomsday Forums
 * Analyzes all HTML files for potential errors before deployment
 */

const fs = require('fs');
const path = require('path');

class CodeAnalyzer {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.files = [];
        this.analyzedFiles = 0;
    }

    // Analyze all HTML files in the project
    async analyzeProject(projectPath = '.') {
        console.log('🔍 Démarrage de l\'analyse du code...');
        
        this.errors = [];
        this.warnings = [];
        this.files = [];
        this.analyzedFiles = 0;

        // Get all HTML files
        const htmlFiles = this.getHtmlFiles(projectPath);
        
        for (const file of htmlFiles) {
            await this.analyzeFile(file);
        }

        this.generateReport();
        return this.errors.length === 0;
    }

    // Get all HTML files recursively
    getHtmlFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                this.getHtmlFiles(filePath, fileList);
            } else if (file.endsWith('.html')) {
                fileList.push(filePath);
            }
        }
        
        return fileList;
    }

    // Analyze a single file
    async analyzeFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);
            
            this.analyzedFiles++;
            console.log(`📄 Analyse de ${fileName}...`);

            // Check for common errors
            this.checkForUndefinedFunctions(content, fileName);
            this.checkForMissingElements(content, fileName);
            this.checkForDuplicateFunctions(content, fileName);
            this.checkForSyntaxErrors(content, fileName);
            this.checkForFirebaseErrors(content, fileName);
            this.checkForEventHandlers(content, fileName);
            this.checkForMissingIds(content, fileName);
            this.checkForInvalidReferences(content, fileName);

        } catch (error) {
            this.errors.push({
                file: filePath,
                type: 'FILE_READ_ERROR',
                message: `Impossible de lire le fichier: ${error.message}`,
                severity: 'HIGH'
            });
        }
    }

    // Check for undefined function calls
    checkForUndefinedFunctions(content, fileName) {
        const functionCalls = content.match(/\b(\w+)\s*\(/g);
        const functionDefinitions = content.match(/function\s+(\w+)\s*\(/g);
        
        if (!functionCalls || !functionDefinitions) return;

        const definedFunctions = new Set();
        functionDefinitions.forEach(def => {
            const match = def.match(/function\s+(\w+)\s*\(/);
            if (match) definedFunctions.add(match[1]);
        });

        functionCalls.forEach(call => {
            const funcName = call.replace(/\s*\(/, '');
            
            // Skip common built-in functions
            const builtInFunctions = [
                'console', 'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat',
                'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
                'addEventListener', 'removeEventListener', 'getElementById',
                'querySelector', 'querySelectorAll', 'createElement',
                'appendChild', 'removeChild', 'classList', 'style',
                'push', 'pop', 'shift', 'unshift', 'slice', 'splice',
                'JSON', 'Date', 'Math', 'Array', 'Object', 'String',
                'Number', 'Boolean', 'RegExp', 'Error', 'Promise',
                'fetch', 'localStorage', 'sessionStorage', 'location',
                'window', 'document', 'navigator', 'history'
            ];

            if (!builtInFunctions.includes(funcName) && 
                !definedFunctions.has(funcName) && 
                !funcName.startsWith('on') &&
                !content.includes(`const ${funcName} =`) &&
                !content.includes(`let ${funcName} =`) &&
                !content.includes(`var ${funcName} =`)) {
                
                this.warnings.push({
                    file: fileName,
                    type: 'UNDEFINED_FUNCTION',
                    message: `Fonction potentiellement non définie: ${funcName}`,
                    severity: 'MEDIUM'
                });
            }
        });
    }

    // Check for missing DOM elements
    checkForMissingElements(content, fileName) {
        const getElementByIdCalls = content.match(/getElementById\(['"`]([^'"`]+)['"`]\)/g);
        
        if (getElementByIdCalls) {
            getElementByIdCalls.forEach(call => {
                const id = call.match(/getElementById\(['"`]([^'"`]+)['"`]\)/)[1];
                
                // Check if element with this ID exists in the HTML
                const idRegex = new RegExp(`id=["'"]${id}["'"]`, 'i');
                if (!idRegex.test(content)) {
                    this.errors.push({
                        file: fileName,
                        type: 'MISSING_ELEMENT',
                        message: `Élément avec ID '${id}' non trouvé dans le HTML`,
                        severity: 'HIGH'
                    });
                }
            });
        }
    }

    // Check for duplicate function definitions
    checkForDuplicateFunctions(content, fileName) {
        const functionDefinitions = content.match(/function\s+(\w+)\s*\(/g);
        
        if (functionDefinitions) {
            const functionCounts = {};
            
            functionDefinitions.forEach(def => {
                const match = def.match(/function\s+(\w+)\s*\(/);
                if (match) {
                    const funcName = match[1];
                    functionCounts[funcName] = (functionCounts[funcName] || 0) + 1;
                }
            });

            Object.entries(functionCounts).forEach(([funcName, count]) => {
                if (count > 1) {
                    this.errors.push({
                        file: fileName,
                        type: 'DUPLICATE_FUNCTION',
                        message: `Fonction dupliquée: ${funcName} (${count} occurrences)`,
                        severity: 'HIGH'
                    });
                }
            });
        }
    }

    // Check for syntax errors
    checkForSyntaxErrors(content, fileName) {
        // Check for unmatched brackets
        const openBrackets = (content.match(/\{/g) || []).length;
        const closeBrackets = (content.match(/\}/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
            this.errors.push({
                file: fileName,
                type: 'SYNTAX_ERROR',
                message: `Accolades non équilibrées: ${openBrackets} ouvertes, ${closeBrackets} fermées`,
                severity: 'HIGH'
            });
        }

        // Check for unmatched parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        
        if (openParens !== closeParens) {
            this.errors.push({
                file: fileName,
                type: 'SYNTAX_ERROR',
                message: `Parenthèses non équilibrées: ${openParens} ouvertes, ${closeParens} fermées`,
                severity: 'HIGH'
            });
        }
    }

    // Check for Firebase-related errors
    checkForFirebaseErrors(content, fileName) {
        // Check for Firebase usage without proper initialization
        if (content.includes('database.ref(') || content.includes('auth.')) {
            if (!content.includes('firebase.initializeApp')) {
                this.warnings.push({
                    file: fileName,
                    type: 'FIREBASE_INIT',
                    message: 'Utilisation de Firebase sans initialisation explicite',
                    severity: 'MEDIUM'
                });
            }
        }

        // Check for missing error handling in Firebase operations
        const firebaseCalls = content.match(/database\.ref\([^)]+)\)\.(push|set|update|once|on)\(/g);
        if (firebaseCalls) {
            firebaseCalls.forEach(call => {
                // Look for .catch() or error callback
                const lines = content.split('\n');
                let foundErrorHandling = false;
                
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(call)) {
                        // Check next few lines for error handling
                        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
                            if (lines[j].includes('.catch(') || 
                                lines[j].includes('error') || 
                                lines[j].includes('catch')) {
                                foundErrorHandling = true;
                                break;
                            }
                        }
                        break;
                    }
                }

                if (!foundErrorHandling) {
                    this.warnings.push({
                        file: fileName,
                        type: 'FIREBASE_ERROR_HANDLING',
                        message: `Opération Firebase sans gestion d'erreur: ${call}`,
                        severity: 'MEDIUM'
                    });
                }
            });
        }
    }

    // Check for event handler issues
    checkForEventHandlers(content, fileName) {
        // Check for onclick handlers that reference non-existent functions
        const onclickHandlers = content.match(/onclick=["']([^"']+)["']/g);
        
        if (onclickHandlers) {
            onclickHandlers.forEach(handler => {
                const funcCall = handler.match(/onclick=["']([^"']+)["']/)[1];
                
                // Extract function name
                const funcMatch = funcCall.match(/^(\w+)\(/);
                if (funcMatch) {
                    const funcName = funcMatch[1];
                    
                    // Check if function exists
                    if (!content.includes(`function ${funcName}(`) && 
                        !content.includes(`const ${funcName} =`) &&
                        !content.includes(`let ${funcName} =`) &&
                        !content.includes(`var ${funcName} =`)) {
                        
                        this.errors.push({
                            file: fileName,
                            type: 'MISSING_EVENT_HANDLER',
                            message: `Gestionnaire d'événement non trouvé: ${funcName}`,
                            severity: 'HIGH'
                        });
                    }
                }
            });
        }
    }

    // Check for missing IDs referenced in CSS
    checkForMissingIds(content, fileName) {
        // Extract CSS selectors that reference IDs
        const cssIdSelectors = content.match(/#[\w-]+/g);
        
        if (cssIdSelectors) {
            cssIdSelectors.forEach(selector => {
                const id = selector.substring(1); // Remove #
                
                // Check if element exists in HTML
                const idRegex = new RegExp(`id=["'"]${id}["'"]`, 'i');
                if (!idRegex.test(content)) {
                    this.warnings.push({
                        file: fileName,
                        type: 'UNUSED_CSS_ID',
                        message: `Sélecteur CSS ID non utilisé: #${id}`,
                        severity: 'LOW'
                    });
                }
            });
        }
    }

    // Check for invalid references
    checkForInvalidReferences(content, fileName) {
        // Check for references to undefined variables
        const variableReferences = content.match(/\b(currentUser|currentUserRole|auth|database)\b/g);
        
        if (variableReferences) {
            // Check if these variables are properly declared
            const hasCurrentUser = content.includes('let currentUser') || content.includes('var currentUser');
            const hasCurrentUserRole = content.includes('let currentUserRole') || content.includes('var currentUserRole');
            const hasAuth = content.includes('const auth = firebase.auth()');
            const hasDatabase = content.includes('const database = firebase.database()');

            if (!hasCurrentUser && content.includes('currentUser')) {
                this.errors.push({
                    file: fileName,
                    type: 'UNDEFINED_VARIABLE',
                    message: 'Variable currentUser utilisée mais non déclarée',
                    severity: 'HIGH'
                });
            }

            if (!hasCurrentUserRole && content.includes('currentUserRole')) {
                this.errors.push({
                    file: fileName,
                    type: 'UNDEFINED_VARIABLE',
                    message: 'Variable currentUserRole utilisée mais non déclarée',
                    severity: 'HIGH'
                });
            }

            if (!hasAuth && content.includes('auth.')) {
                this.errors.push({
                    file: fileName,
                    type: 'UNDEFINED_VARIABLE',
                    message: 'Variable auth utilisée mais non initialisée',
                    severity: 'HIGH'
                });
            }

            if (!hasDatabase && content.includes('database.')) {
                this.errors.push({
                    file: fileName,
                    type: 'UNDEFINED_VARIABLE',
                    message: 'Variable database utilisée mais non initialisée',
                    severity: 'HIGH'
                });
            }
        }
    }

    // Generate analysis report
    generateReport() {
        console.log('\n📊 RAPPORT D\'ANALYSE DU CODE');
        console.log('='.repeat(50));
        console.log(`Fichiers analysés: ${this.analyzedFiles}`);
        console.log(`Erreurs trouvées: ${this.errors.length}`);
        console.log(`Avertissements: ${this.warnings.length}`);
        console.log('');

        if (this.errors.length > 0) {
            console.log('🚨 ERREURS CRITIQUES:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. [${error.severity}] ${error.file}`);
                console.log(`   Type: ${error.type}`);
                console.log(`   Message: ${error.message}`);
                console.log('');
            });
        }

        if (this.warnings.length > 0) {
            console.log('⚠️  AVERTISSEMENTS:');
            this.warnings.forEach((warning, index) => {
                console.log(`${index + 1}. [${warning.severity}] ${warning.file}`);
                console.log(`   Type: ${warning.type}`);
                console.log(`   Message: ${warning.message}`);
                console.log('');
            });
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ Aucune erreur détectée! Le code est propre.');
        }

        // Save report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            analyzedFiles: this.analyzedFiles,
            errors: this.errors,
            warnings: this.warnings,
            summary: {
                totalErrors: this.errors.length,
                totalWarnings: this.warnings.length,
                status: this.errors.length === 0 ? 'PASS' : 'FAIL'
            }
        };

        fs.writeFileSync('code-analysis-report.json', JSON.stringify(reportData, null, 2));
        console.log('📄 Rapport sauvegardé dans: code-analysis-report.json');
    }
}

// Export for use in other scripts
module.exports = CodeAnalyzer;

// If run directly
if (require.main === module) {
    const analyzer = new CodeAnalyzer();
    analyzer.analyzeProject().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Erreur lors de l\'analyse:', error);
        process.exit(1);
    });
}
