/**
 * Bundle Size Analysis for Drizzle ORM Migration
 * Analyzes the impact of Drizzle on bundle size
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BundleAnalysis {
  timestamp: Date;
  baseline: {
    mainSize: number;
    rendererSize: number;
    totalSize: number;
    dependencies: Record<string, number>;
  };
  withDrizzle: {
    mainSize: number;
    rendererSize: number;
    totalSize: number;
    dependencies: Record<string, number>;
  };
  comparison: {
    mainDiff: number;
    rendererDiff: number;
    totalDiff: number;
    percentIncrease: number;
    withinTarget: boolean;
  };
}

class BundleSizeAnalyzer {
  private distPath: string;
  private tempPath: string;

  constructor() {
    this.distPath = path.join(__dirname, '../dist');
    this.tempPath = path.join(__dirname, '../temp-analysis');
  }

  /**
   * Get size of a file or directory
   */
  private async getSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(filePath);
        let totalSize = 0;
        
        for (const file of files) {
          const fullPath = path.join(filePath, file);
          totalSize += await this.getSize(fullPath);
        }
        
        return totalSize;
      } else {
        return stats.size;
      }
    } catch (error) {
      console.warn(`Could not get size of ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Build the application
   */
  private async buildApp(): Promise<void> {
    console.log('  📦 Building application...');
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: path.join(__dirname, '..')
    });
    
    if (stderr && !stderr.includes('warning')) {
      console.error('Build warnings/errors:', stderr);
    }
  }

  /**
   * Analyze dependencies size
   */
  private async analyzeDependencies(): Promise<Record<string, number>> {
    const deps: Record<string, number> = {};
    const nodeModulesPath = path.join(__dirname, '../node_modules');
    
    // Key dependencies to analyze
    const keyDeps = [
      'drizzle-orm',
      'better-sqlite3',
      'electron',
      'react',
      'react-dom',
      '@electron-forge',
      'typescript'
    ];

    for (const dep of keyDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      try {
        deps[dep] = await this.getSize(depPath);
      } catch {
        deps[dep] = 0;
      }
    }

    return deps;
  }

  /**
   * Analyze bundle with specific configuration
   */
  private async analyzeBundle(useDrizzle: boolean): Promise<{
    mainSize: number;
    rendererSize: number;
    totalSize: number;
    dependencies: Record<string, number>;
  }> {
    // Set environment variable
    process.env.USE_DRIZZLE = useDrizzle ? 'true' : 'false';
    
    // Build the application
    await this.buildApp();
    
    // Get bundle sizes
    const mainPath = path.join(this.distPath, 'main');
    const rendererPath = path.join(this.distPath, 'renderer');
    
    const mainSize = await this.getSize(mainPath);
    const rendererSize = await this.getSize(rendererPath);
    const totalSize = mainSize + rendererSize;
    
    // Analyze dependencies
    const dependencies = await this.analyzeDependencies();
    
    return {
      mainSize,
      rendererSize,
      totalSize,
      dependencies
    };
  }

  /**
   * Run full bundle size analysis
   */
  public async analyze(): Promise<BundleAnalysis> {
    console.log('\n📊 Bundle Size Analysis');
    console.log('='.repeat(60));
    
    // Clean dist directory
    console.log('🧹 Cleaning dist directory...');
    try {
      await fs.rm(this.distPath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    // Analyze baseline (without Drizzle)
    console.log('\n📦 Analyzing baseline bundle (Raw SQL)...');
    const baseline = await this.analyzeBundle(false);
    
    // Save baseline dist
    console.log('  💾 Saving baseline build...');
    await fs.rename(this.distPath, `${this.distPath}-baseline`);
    
    // Analyze with Drizzle
    console.log('\n📦 Analyzing bundle with Drizzle...');
    const withDrizzle = await this.analyzeBundle(true);
    
    // Calculate comparison
    const mainDiff = withDrizzle.mainSize - baseline.mainSize;
    const rendererDiff = withDrizzle.rendererSize - baseline.rendererSize;
    const totalDiff = withDrizzle.totalSize - baseline.totalSize;
    const percentIncrease = (totalDiff / baseline.totalSize) * 100;
    const withinTarget = totalDiff < 10240; // Less than 10KB increase
    
    // Restore baseline for comparison
    await fs.rename(`${this.distPath}-baseline`, `${this.distPath}-comparison`);
    
    return {
      timestamp: new Date(),
      baseline,
      withDrizzle,
      comparison: {
        mainDiff,
        rendererDiff,
        totalDiff,
        percentIncrease,
        withinTarget
      }
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Print analysis report
   */
  public printReport(analysis: BundleAnalysis): void {
    console.log('\n' + '='.repeat(60));
    console.log('              BUNDLE SIZE ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${analysis.timestamp.toISOString()}`);
    
    console.log('\n📦 BASELINE (Raw SQL):');
    console.log('-'.repeat(60));
    console.log(`  Main Process:     ${this.formatBytes(analysis.baseline.mainSize)}`);
    console.log(`  Renderer Process: ${this.formatBytes(analysis.baseline.rendererSize)}`);
    console.log(`  Total Size:       ${this.formatBytes(analysis.baseline.totalSize)}`);
    
    console.log('\n📦 WITH DRIZZLE:');
    console.log('-'.repeat(60));
    console.log(`  Main Process:     ${this.formatBytes(analysis.withDrizzle.mainSize)}`);
    console.log(`  Renderer Process: ${this.formatBytes(analysis.withDrizzle.rendererSize)}`);
    console.log(`  Total Size:       ${this.formatBytes(analysis.withDrizzle.totalSize)}`);
    
    console.log('\n📊 COMPARISON:');
    console.log('-'.repeat(60));
    console.log(`  Main Process Diff:     ${this.formatDiff(analysis.comparison.mainDiff)}`);
    console.log(`  Renderer Process Diff: ${this.formatDiff(analysis.comparison.rendererDiff)}`);
    console.log(`  Total Size Diff:       ${this.formatDiff(analysis.comparison.totalDiff)}`);
    console.log(`  Percentage Increase:   ${analysis.comparison.percentIncrease.toFixed(2)}%`);
    
    console.log('\n📋 KEY DEPENDENCIES SIZE:');
    console.log('-'.repeat(60));
    const drizzleSize = analysis.withDrizzle.dependencies['drizzle-orm'] || 0;
    console.log(`  drizzle-orm:    ${this.formatBytes(drizzleSize)}`);
    console.log(`  better-sqlite3: ${this.formatBytes(analysis.withDrizzle.dependencies['better-sqlite3'] || 0)}`);
    console.log(`  electron:       ${this.formatBytes(analysis.withDrizzle.dependencies['electron'] || 0)}`);
    console.log(`  react:          ${this.formatBytes(analysis.withDrizzle.dependencies['react'] || 0)}`);
    
    console.log('\n📈 VERDICT:');
    console.log('-'.repeat(60));
    
    if (analysis.comparison.withinTarget) {
      console.log('✅ PASSED: Bundle size increase is within target (<10KB)');
      console.log(`   Actual increase: ${this.formatBytes(analysis.comparison.totalDiff)}`);
      console.log(`   Target maximum:  ${this.formatBytes(10240)}`);
    } else {
      console.log('❌ FAILED: Bundle size increase exceeds target (>10KB)');
      console.log(`   Actual increase: ${this.formatBytes(analysis.comparison.totalDiff)}`);
      console.log(`   Target maximum:  ${this.formatBytes(10240)}`);
      console.log(`   Exceeded by:     ${this.formatBytes(analysis.comparison.totalDiff - 10240)}`);
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Format size difference
   */
  private formatDiff(diff: number): string {
    const formatted = this.formatBytes(Math.abs(diff));
    return diff >= 0 ? `+${formatted}` : `-${formatted}`;
  }

  /**
   * Save analysis to file
   */
  public async saveReport(analysis: BundleAnalysis): Promise<void> {
    const reportPath = path.join(__dirname, '../bundle-analysis.json');
    await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));
    console.log(`\n📄 Analysis saved to: ${reportPath}`);
  }

  /**
   * Clean up temporary files
   */
  public async cleanup(): Promise<void> {
    try {
      await fs.rm(`${this.distPath}-comparison`, { recursive: true, force: true });
    } catch {
      // Might not exist
    }
  }
}

/**
 * Main analysis runner
 */
async function main() {
  console.log('🚀 Starting Bundle Size Analysis');
  console.log('=' .repeat(60));
  
  const analyzer = new BundleSizeAnalyzer();
  
  try {
    // Run analysis
    const analysis = await analyzer.analyze();
    
    // Print report
    analyzer.printReport(analysis);
    
    // Save report
    await analyzer.saveReport(analysis);
    
    // Clean up
    await analyzer.cleanup();
    
    // Exit with appropriate code
    process.exit(analysis.comparison.withinTarget ? 0 : 1);
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { BundleSizeAnalyzer, BundleAnalysis };