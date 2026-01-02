/**
 * Pre-deployment Check Script
 * Runs code analysis before allowing deployment
 */

const CodeAnalyzer = require('./code-analyzer');
const fs = require('fs');
const path = require('path');

class PreDeployChecker {
    constructor() {
        this.analyzer = new CodeAnalyzer();
        this.projectPath = '.';
    }

    async runPreDeployCheck() {
        console.log('🚀 Vérification pré-déploiement...');
        console.log('=====================================');

        // 1. Run code analysis
        const analysisSuccess = await this.analyzer.analyzeProject(this.projectPath);

        // 2. Check for critical files
        this.checkCriticalFiles();

        // 3. Validate Firebase configuration
        this.validateFirebaseConfig();

        // 4. Check for security issues
        this.checkSecurityIssues();

        // 5. Generate final report
        this.generateFinalReport(analysisSuccess);

        return analysisSuccess;
    }

    checkCriticalFiles() {
        console.log('📁 Vérification des fichiers critiques...');

        const criticalFiles = [
            'index.html',
            'admin.html',
            'category-posts.html',
            'profile.html',
            'messages.html'
        ];

        criticalFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                this.analyzer.errors.push({
                    file: file,
                    type: 'MISSING_CRITICAL_FILE',
                    message: `Fichier critique manquant: ${file}`,
                    severity: 'CRITICAL'
                });
            } else {
                console.log(`✅ ${file} - trouvé`);
            }
        });
    }

    validateFirebaseConfig() {
        console.log('🔥 Validation de la configuration Firebase...');

        try {
            const indexContent = fs.readFileSync('index.html', 'utf8');
            
            // Check for Firebase SDK
            if (!indexContent.includes('firebase-app-compat.js')) {
                this.analyzer.errors.push({
                    file: 'index.html',
                    type: 'MISSING_FIREBASE_SDK',
                    message: 'SDK Firebase manquant',
                    severity: 'HIGH'
                });
            }

            // Check for Firebase config
            if (!indexContent.includes('firebaseConfig')) {
                this.analyzer.errors.push({
                    file: 'index.html',
                    type: 'MISSING_FIREBASE_CONFIG',
                    message: 'Configuration Firebase manquante',
                    severity: 'HIGH'
                });
            }

            // Check for Firebase initialization
            if (!indexContent.includes('firebase.initializeApp')) {
                this.analyzer.errors.push({
                    file: 'index.html',
                    type: 'MISSING_FIREBASE_INIT',
                    message: 'Initialisation Firebase manquante',
                    severity: 'HIGH'
                });
            }

            console.log('✅ Configuration Firebase validée');

        } catch (error) {
            this.analyzer.errors.push({
                file: 'index.html',
                type: 'FIREBASE_CONFIG_ERROR',
                message: `Erreur lors de la validation Firebase: ${error.message}`,
                severity: 'HIGH'
            });
        }
    }

    checkSecurityIssues() {
        console.log('🔒 Vérification des problèmes de sécurité...');

        const securityPatterns = [
            {
                pattern: /eval\s*\(/,
                type: 'DANGEROUS_EVAL',
                message: 'Utilisation dangereuse de eval()',
                severity: 'HIGH'
            },
            {
                pattern: /innerHTML\s*=/,
                type: 'XSS_RISK',
                message: 'Utilisation de innerHTML sans sanitisation',
                severity: 'MEDIUM'
            },
            {
                pattern: /document\.write/,
                type: 'XSS_RISK',
                message: 'Utilisation de document.write',
                severity: 'MEDIUM'
            },
            {
                pattern: /password\s*=\s*["'][^"']*["']/,
                type: 'HARDCODED_PASSWORD',
                message: 'Mot de passe en dur dans le code',
                severity: 'CRITICAL'
            },
            {
                pattern: /api[_-]?key\s*=\s*["'][^"']*["']/,
                type: 'EXPOSED_API_KEY',
                message: 'Clé API exposée dans le code',
                severity: 'HIGH'
            }
        ];

        const htmlFiles = this.analyzer.getHtmlFiles(this.projectPath);

        htmlFiles.forEach(filePath => {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = path.basename(filePath);

                securityPatterns.forEach(pattern => {
                    if (pattern.pattern.test(content)) {
                        this.analyzer.errors.push({
                            file: fileName,
                            type: pattern.type,
                            message: pattern.message,
                            severity: pattern.severity
                        });
                    }
                });
            } catch (error) {
                console.warn(`Impossible d'analyser ${filePath}: ${error.message}`);
            }
        });

        console.log('✅ Vérification de sécurité terminée');
    }

    generateFinalReport(analysisSuccess) {
        console.log('\n📋 RAPPORT FINAL PRÉ-DÉPLOIEMENT');
        console.log('=====================================');

        const totalIssues = this.analyzer.errors.length + this.analyzer.warnings.length;
        const criticalIssues = this.analyzer.errors.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH').length;

        console.log(`📊 Statistiques:`);
        console.log(`   - Erreurs totales: ${this.analyzer.errors.length}`);
        console.log(`   - Avertissements: ${this.analyzer.warnings.length}`);
        console.log(`   - Problèmes critiques: ${criticalIssues}`);

        if (criticalIssues > 0) {
            console.log('\n🚨 DÉPLOIEMENT BLOQUÉ - Problèmes critiques détectés:');
            this.analyzer.errors
                .filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH')
                .forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.file}: ${error.message}`);
                });
            console.log('\n❌ Veuillez corriger les problèmes critiques avant de déployer.');
        } else if (this.analyzer.errors.length > 0) {
            console.log('\n⚠️  DÉPLOIEMENT DÉCONSEILLÉ - Erreurs détectées:');
            this.analyzer.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.file}: ${error.message}`);
            });
            console.log('\n⚠️  Il est recommandé de corriger ces erreurs avant de déployer.');
        } else if (this.analyzer.warnings.length > 0) {
            console.log('\n✅ DÉPLOIEMENT AUTORISÉ - Avertissements uniquement:');
            console.log(`   ${this.analyzer.warnings.length} avertissements à considérer.`);
        } else {
            console.log('\n🎉 DÉPLOIEMENT AUTORISÉ - Aucun problème détecté!');
        }

        // Save deployment report
        const deployReport = {
            timestamp: new Date().toISOString(),
            deploymentStatus: criticalIssues > 0 ? 'BLOCKED' : 
                            this.analyzer.errors.length > 0 ? 'WARNING' : 'ALLOWED',
            summary: {
                totalErrors: this.analyzer.errors.length,
                totalWarnings: this.analyzer.warnings.length,
                criticalIssues: criticalIssues
            },
            files: this.analyzer.analyzedFiles,
            recommendations: this.getRecommendations()
        };

        fs.writeFileSync('deployment-report.json', JSON.stringify(deployReport, null, 2));
        console.log('\n📄 Rapport de déploiement sauvegardé dans: deployment-report.json');

        return criticalIssues === 0;
    }

    getRecommendations() {
        const recommendations = [];

        if (this.analyzer.errors.some(e => e.type === 'UNDEFINED_FUNCTION')) {
            recommendations.push('Corrigez les fonctions non définies avant le déploiement');
        }

        if (this.analyzer.errors.some(e => e.type === 'MISSING_ELEMENT')) {
            recommendations.push('Assurez-vous que tous les éléments référencés existent dans le HTML');
        }

        if (this.analyzer.errors.some(e => e.type === 'SYNTAX_ERROR')) {
            recommendations.push('Corrigez les erreurs de syntaxe JavaScript');
        }

        if (this.analyzer.warnings.some(w => w.type === 'FIREBASE_ERROR_HANDLING')) {
            recommendations.push('Ajoutez une gestion d\'erreur pour toutes les opérations Firebase');
        }

        if (recommendations.length === 0) {
            recommendations.push('Le code est prêt pour le déploiement');
        }

        return recommendations;
    }
}

// Export for use in other scripts
module.exports = PreDeployChecker;

// If run directly
if (require.main === module) {
    const checker = new PreDeployChecker();
    checker.runPreDeployCheck().then(success => {
        if (success) {
            console.log('\n🎉 Vérification pré-déploiement terminée avec succès!');
            process.exit(0);
        } else {
            console.log('\n❌ Vérification pré-déploiement a échoué!');
            process.exit(1);
        }
    }).catch(error => {
        console.error('Erreur lors de la vérification pré-déploiement:', error);
        process.exit(1);
    });
}
