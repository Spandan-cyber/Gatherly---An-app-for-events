#!/usr/bin/env python3
"""
Gatherly Comprehensive Test Runner
Executes all unit, integration, AI assistant, and accessibility tests.
"""
import unittest
import sys
import os

if __name__ == '__main__':
    # Add root directory to sys.path
    project_root = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, project_root)

    print("=" * 60)
    print("   GATHERLY TEST SUITE - RUNNING ALL AUTOMATED TESTS")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=os.path.join(project_root, 'tests'), pattern='test_*.py')

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print(f"Tests Run: {result.testsRun} | Errors: {len(result.errors)} | Failures: {len(result.failures)}")
    print("=" * 60)

    sys.exit(0 if result.wasSuccessful() else 1)
