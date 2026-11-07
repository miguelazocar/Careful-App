// Background tasks must be defined at module load, before the router mounts,
// so Android can run them headless (e.g. scheduled backups).
import './src/services/background';
import 'expo-router/entry';
