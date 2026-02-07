#!/usr/bin/env node
/**
 * Interactive Fork Initialization Script
 * 
 * This script helps you customize your fork of the SaaS platform template
 * by updating package names, repository URLs, and configuration values.
 * 
 * Usage: node scripts/initialize-fork.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

async function main() {
  console.log('\n');
  log('═══════════════════════════════════════════════════════════', 'info');
  log('   🚀 SaaS Platform Template - Fork Initialization', 'info');
  log('═══════════════════════════════════════════════════════════', 'info');
  console.log('\n');
  
  log('This script will help you customize your fork by updating:', 'info');
  log('  • Package names and organization', 'info');
  log('  • Repository URLs', 'info');
  log('  • Admin credentials', 'info');
  log('  • Environment configuration', 'info');
  console.log('\n');

  // Collect information
  const orgName = await question('📦 Organization name (e.g., @mycompany): ');
  const projectName = await question('📝 Project name (e.g., my-saas-platform): ');
  const githubOrg = await question('🔗 GitHub organization/username: ');
  const githubRepo = await question('🔗 GitHub repository name: ');
  const adminEmail = await question('👤 Admin email address: ');
  const adminPassword = await question('🔐 Admin password (or leave empty for default): ');
  const companyName = await question('🏢 Company/Product name: ');

  rl.close();

  console.log('\n');
  log('📋 Configuration Summary:', 'info');
  log(`   Organization: ${orgName}`, 'info');
  log(`   Project: ${projectName}`, 'info');
  log(`   GitHub: ${githubOrg}/${githubRepo}`, 'info');
  log(`   Admin Email: ${adminEmail}`, 'info');
  log(`   Company: ${companyName}`, 'info');
  console.log('\n');

  const confirm = await new Promise(resolve => {
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl2.question('Continue with these settings? (y/n): ', answer => {
      rl2.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });

  if (!confirm) {
    log('❌ Initialization cancelled', 'error');
    process.exit(0);
  }

  console.log('\n');
  log('🔧 Updating configuration files...', 'info');

  try {
    // Update root package.json
    updatePackageJson(
      path.join(__dirname, '../package.json'),
      orgName,
      projectName,
      githubOrg,
      githubRepo
    );

    // Update package files
    const packages = [
      'packages/@tinadmin/core',
      'packages/@tinadmin/config',
      'packages/@tinadmin/ui-admin',
      'packages/@tinadmin/ui-consumer',
      'apps/tenant',
      'apps/portal'
    ];

    packages.forEach(pkg => {
      const pkgPath = path.join(__dirname, '..', pkg, 'package.json');
      if (fs.existsSync(pkgPath)) {
        updatePackageJson(pkgPath, orgName, projectName, githubOrg, githubRepo);
      }
    });

    // Create .env.local from .env.example
    createEnvLocal(adminEmail, adminPassword || 'ChangeThisPassword123!');

    // Update supabase config
    updateSupabaseConfig(projectName);

    log('\n✅ Initialization complete!', 'success');
    console.log('\n');
    log('📝 Next Steps:', 'info');
    log('   1. Review and update .env.local with your Supabase credentials', 'info');
    log('   2. Run: pnpm install', 'info');
    log('   3. Run: supabase start (for local development)', 'info');
    log('   4. Run: pnpm dev', 'info');
    log('   5. Update README.md with your project details', 'info');
    console.log('\n');
    log('📚 See FORK_GUIDE.md for detailed customization instructions', 'info');
    console.log('\n');

  } catch (error) {
    log(`\n❌ Error during initialization: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

function updatePackageJson(filePath, orgName, projectName, githubOrg, githubRepo) {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Update name if it contains placeholder
    if (content.name && content.name.includes('@your-org')) {
      content.name = `${orgName}/${projectName}`;
    }
    
    // Update repository URLs
    if (content.repository && content.repository.url) {
      content.repository.url = `git+https://github.com/${githubOrg}/${githubRepo}.git`;
    }
    
    if (content.bugs && content.bugs.url) {
      content.bugs.url = `https://github.com/${githubOrg}/${githubRepo}/issues`;
    }
    
    if (content.homepage) {
      content.homepage = `https://github.com/${githubOrg}/${githubRepo}#readme`;
    }
    
    // Update author if it's placeholder
    if (content.author === 'Your Organization') {
      content.author = orgName.replace('@', '');
    }
    
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    log(`   ✓ Updated ${path.relative(process.cwd(), filePath)}`, 'success');
  } catch (error) {
    log(`   ⚠ Could not update ${filePath}: ${error.message}`, 'warning');
  }
}

function createEnvLocal(adminEmail, adminPassword) {
  const envExamplePath = path.join(__dirname, '../.env.example');
  const envLocalPath = path.join(__dirname, '../.env.local');
  
  if (!fs.existsSync(envExamplePath)) {
    log('   ⚠ .env.example not found, skipping .env.local creation', 'warning');
    return;
  }
  
  if (fs.existsSync(envLocalPath)) {
    log('   ⚠ .env.local already exists, skipping', 'warning');
    return;
  }
  
  let content = fs.readFileSync(envExamplePath, 'utf8');
  
  // Replace placeholder values
  content = content.replace('PLATFORM_ADMIN_EMAIL=admin@yourcompany.com', `PLATFORM_ADMIN_EMAIL=${adminEmail}`);
  content = content.replace('PLATFORM_ADMIN_PASSWORD=ChangeThisPassword123!', `PLATFORM_ADMIN_PASSWORD=${adminPassword}`);
  
  fs.writeFileSync(envLocalPath, content);
  log('   ✓ Created .env.local from template', 'success');
}

function updateSupabaseConfig(projectName) {
  const configPath = path.join(__dirname, '../supabase/config.toml');
  
  if (!fs.existsSync(configPath)) {
    return;
  }
  
  try {
    let content = fs.readFileSync(configPath, 'utf8');
    content = content.replace(/project_id = ".*"/, `project_id = "${projectName}"`);
    fs.writeFileSync(configPath, content);
    log('   ✓ Updated supabase/config.toml', 'success');
  } catch (error) {
    log(`   ⚠ Could not update supabase config: ${error.message}`, 'warning');
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});

