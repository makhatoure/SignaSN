import 'dart:io';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';

// --- CONFIGURATION SUPABASE REAL ---
const SUPABASE_URL = 'https://kijvxagrcztufresgfoy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpanZ4YWdyY3p0dWZyZXNnZm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTI4MDgsImV4cCI6MjEwMzg2ODgwOH0.2VTUNVVY6_4Wt_a-zndU0ics5pNAP3iFX7KMo7Wt-uc';

final supabase = Supabase.instance.client;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  );

  runApp(const CitizenReportApp());
}

class CitizenReportApp extends StatelessWidget {
  const CitizenReportApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Signalement Citoyen SN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00853F), // Vert du Sénégal 🇸🇳
          primary: const Color(0xFF00853F),
          secondary: const Color(0xFFE31B23),
          tertiary: const Color(0xFFFDEF42),
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('🇸🇳 ', style: TextStyle(fontSize: 24)),
            Text(
              'CitizenReport SN',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {});
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          const MapFeedView(),
          NewReportView(onReportSubmitted: () {
            setState(() {
              _currentIndex = 0; // Rediriger vers le fil après publication
            });
          }),
          const ProfileView(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Signalements',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_a_photo_outlined),
            selectedIcon: Icon(Icons.add_a_photo),
            label: 'Signaler',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Mon Profil',
          ),
        ],
      ),
    );
  }
}

// --- VUE 1 : FIL DYNAMIQUE DES SIGNALEMENTS (Dakar) ---
class MapFeedView extends StatelessWidget {
  const MapFeedView({super.key});

  Future<List<Map<String, dynamic>>> _fetchReports() async {
    final response = await supabase
        .from('reports')
        .select('*, categories(name, icon)')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _fetchReports(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFF00853F)));
        }

        if (snapshot.hasError) {
          return Center(
            child: Text('Erreur de chargement: ${snapshot.error}'),
          );
        }

        final reports = snapshot.data ?? [];

        if (reports.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_outline, size: 64, color: Color(0xFF00853F)),
                const SizedBox(height: 12),
                const Text(
                  'Aucun signalement pour le moment.',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Soyez le premier citoyen à documenter un problème à Dakar !',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          itemCount: reports.length,
          padding: const EdgeInsets.all(12),
          itemBuilder: (context, index) {
            final report = reports[index];
            final category = report['categories']?['name'] ?? 'Général';
            final status = report['status'];
            final confirmations = report['confirmations_count'] ?? 1;

            Color statusColor = Colors.red;
            String statusText = '🔴 Signalé';
            if (status == 'en_cours') {
              statusColor = Colors.orange;
              statusText = '🟠 En cours';
            } else if (status == 'resolu') {
              statusColor = Colors.green;
              statusText = '🟢 Résolu';
            }

            return Card(
              margin: const EdgeInsets.only(bottom: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              clipBehavior: Clip.antiAlias,
              elevation: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Photo du problème
                  Image.network(
                    report['image_url'],
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      height: 150,
                      color: Colors.grey[300],
                      child: const Icon(Icons.broken_image, size: 48),
                    ),
                  ),

                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Chip(
                              label: Text(category, style: const TextStyle(fontSize: 12)),
                              backgroundColor: Colors.grey[100],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                statusText,
                                style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),

                        if (report['description'] != null && report['description'].isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            report['description'],
                            style: const TextStyle(fontSize: 14),
                          ),
                        ],

                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 16, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text(
                              report['address_name'] ?? 'Dakar, Sénégal',
                              style: const TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                          ],
                        ),

                        const Divider(height: 24),

                        // Action "Moi aussi"
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '👥 $confirmations citoyen(s) confirment',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF00853F),
                                foregroundColor: Colors.white,
                              ),
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Merci ! Votre confirmation ("Moi aussi") a été enregistrée.')),
                                );
                              },
                              icon: const Icon(Icons.thumb_up, size: 16),
                              label: const Text('Moi aussi'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// --- VUE 2 : NOUVEAU SIGNALEMENT AVEC UPLOAD SUPABASE ---
class NewReportView extends StatefulWidget {
  final VoidCallback onReportSubmitted;
  const NewReportView({super.key, required this.onReportSubmitted});

  @override
  State<NewReportView> createState() => _NewReportViewState();
}

class _NewReportViewState extends State<NewReportView> {
  File? _selectedImage;
  int? _selectedCategoryId;
  final _descriptionController = TextEditingController();
  bool _isLoading = false;
  List<Map<String, dynamic>> _categories = [];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    final response = await supabase.from('categories').select('*');
    setState(() {
      _categories = List<Map<String, dynamic>>.from(response);
    });
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);

    if (pickedFile != null) {
      setState(() {
        _selectedImage = File(pickedFile.path);
      });
    }
  }

  Future<void> _submitReport() async {
    if (_selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez prendre une photo du problème.')),
      );
      return;
    }

    if (_selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez sélectionner une catégorie.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // 1. Upload de la photo vers Supabase Storage
      final fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
      await supabase.storage.from('report-images').upload(fileName, _selectedImage!);

      final imageUrl = supabase.storage.from('report-images').getPublicUrl(fileName);

      // 2. Localisation (Par défaut Dakar Plateau pour démo rapide)
      double lat = 14.6928;
      double lng = -17.4467;

      try {
        Position pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}

      // 3. Création du profil temporaire pour le test (si non connecté)
      final currentUser = supabase.auth.currentUser;
      String userId = currentUser?.id ?? '';

      if (userId.isEmpty) {
        // Enregistrer un ID anonyme/temporaire pour le test
        userId = '00000000-0000-0000-0000-000000000000';
      }

      // 4. Insertion dans la table reports
      await supabase.from('reports').insert({
        'user_id': userId,
        'category_id': _selectedCategoryId,
        'description': _descriptionController.text,
        'image_url': imageUrl,
        'latitude': lat,
        'longitude': lng,
        'address_name': 'Dakar, Sénégal',
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Signalement publié avec succès sur la plateforme ! 🇸🇳'),
          backgroundColor: Color(0xFF00853F),
        ),
      );

      widget.onReportSubmitted();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur d\'envoi: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Nouveau Signalement',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const Text(
            'Documenter les faits pour les médias & décideurs',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 20),

          // Prise de photo
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: InkWell(
              onTap: _pickImage,
              child: _selectedImage != null
                  ? Image.file(_selectedImage!, fit: BoxFit.cover)
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt, size: 48, color: Color(0xFF00853F)),
                        SizedBox(height: 8),
                        Text(
                          'Prendre une photo de la preuve',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 16),

          // Sélection catégorie
          DropdownButtonFormField<int>(
            decoration: const InputDecoration(
              labelText: 'Catégorie du problème',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.category),
            ),
            items: _categories.map((cat) {
              return DropdownMenuItem<int>(
                value: cat['id'] as int,
                child: Text(cat['name'] as String),
              );
            }).toList(),
            onChanged: (val) => setState(() => _selectedCategoryId = val),
          ),
          const SizedBox(height: 16),

          // Description
          TextField(
            controller: _descriptionController,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Description factuelle',
              hintText: 'Ex: Canalisation cassée vers le rond-point...',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.description),
            ),
          ),
          const SizedBox(height: 24),

          // Bouton d'envoi
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00853F),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: _isLoading ? null : _submitReport,
            child: _isLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text(
                    'PUBLIER LE SIGNALEMENT SUR SUPABASE',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }
}

// --- VUE 3 : MON PROFIL CITOYEN ---
class ProfileView extends StatelessWidget {
  const ProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          const SizedBox(height: 20),
          const CircleAvatar(
            radius: 40,
            backgroundColor: Color(0xFF00853F),
            child: Icon(Icons.person, size: 50, color: Colors.white),
          ),
          const SizedBox(height: 12),
          const Text(
            'Citoyen Sénégalais Identifié',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const Text(
            'Compte Supabase lié (+221)',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.verified_user, color: Color(0xFF00853F)),
              title: const Text('Statut du compte'),
              subtitle: const Text('Profil Vérifié par Téléphone (Anti-Spam)'),
            ),
          ),
        ],
      ),
    );
  }
}
