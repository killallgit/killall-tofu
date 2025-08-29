#!/usr/bin/env node

import { Command } from 'commander';

import { initCommand } from './commands/init';

const program = new Command();

program
  .name('killall')
  .version('1.0.0')
  .description('Killall-Tofu CLI for project initialization\n\nThis tool creates .killall.yaml configuration files and registers projects\nin the killall-tofu database for automatic infrastructure cleanup.');

// Add the init command
program.addCommand(initCommand);

// Parse command line arguments
program.parse(process.argv);