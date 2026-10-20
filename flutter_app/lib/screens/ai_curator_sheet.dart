import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/media_item.dart';
import '../models/chat_message.dart';
import '../services/gemini_service.dart';
import '../theme/app_theme.dart';

class AiCuratorSheet extends StatefulWidget {
  final List<MediaItem> watchlist;
  final Function(MediaItem) onAddTitle;

  const AiCuratorSheet({
    super.key,
    required this.watchlist,
    required this.onAddTitle,
  });

  @override
  State<AiCuratorSheet> createState() => _AiCuratorSheetState();
}

class _AiCuratorSheetState extends State<AiCuratorSheet> {
  final List<ChatMessage> _messages = [];
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  bool _isLoading = false;

  final List<String> _quickPrompts = [
    'What should I watch tonight?',
    'Recommend movies like Inception',
    'Best Denis Villeneuve films',
    'Atmospheric 90s slow burn thrillers',
  ];

  @override
  void initState() {
    super.initState();
    _messages.add(ChatMessage(
      text: "Hello Amin! I am your AI Cinema Curator powered by Google Vertex AI Gemini. Ask me for recommendations, film history deep dives, or what to watch next from your watchlist backlog!",
      isUser: false,
    ));
  }

  Future<void> _sendMessage(String text) async {
    final query = text.trim();
    if (query.isEmpty) return;

    _msgCtrl.clear();
    setState(() {
      _messages.add(ChatMessage(text: query, isUser: true));
      _isLoading = true;
    });
    _scrollToBottom();

    final response = await GeminiService.sendMessage(
      message: query,
      watchlist: widget.watchlist,
    );

    setState(() {
      _messages.add(response);
      _isLoading = false;
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: AppTheme.bgDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, color: AppTheme.accentViolet),
                const SizedBox(width: 8),
                const Text('AI Cinema Curator', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.accentEmerald.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('Vertex AI Gemini', style: TextStyle(fontSize: 11, color: AppTheme.accentEmerald, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderSubtle),

          // Messages List
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _buildMessageBubble(msg);
              },
            ),
          ),

          // Quick Prompt Chips
          SizedBox(
            height: 38,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _quickPrompts.length,
              itemBuilder: (context, index) {
                final prompt = _quickPrompts[index];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(prompt, style: const TextStyle(fontSize: 12)),
                    backgroundColor: AppTheme.bgCard,
                    onPressed: () => _sendMessage(prompt),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Input Toolbar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _msgCtrl,
                      onSubmitted: _sendMessage,
                      decoration: const InputDecoration(
                        hintText: 'Ask your AI Curator…',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(
                      backgroundColor: AppTheme.accentViolet,
                    ),
                    icon: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.arrow_upward),
                    onPressed: _isLoading ? null : () => _sendMessage(_msgCtrl.text),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: msg.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: msg.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!msg.isUser) ...[
                const CircleAvatar(
                  radius: 14,
                  backgroundColor: AppTheme.accentViolet,
                  child: Icon(Icons.auto_awesome, size: 14, color: Colors.white),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: msg.isUser ? AppTheme.accentViolet : AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderSubtle),
                  ),
                  child: Text(
                    msg.text,
                    style: const TextStyle(fontSize: 14, height: 1.4),
                  ),
                ),
              ),
            ],
          ),

          // Render Recommendations with 1-click Add to Watchlist
          if (msg.recommendations.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 36),
              child: Column(
                children: msg.recommendations.map((rec) => _buildRecCard(rec)).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRecCard(MediaItem rec) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF181A2D),
        borderRadius: BorderRadius.circular(12),
        border: Border.Border.all(color: AppTheme.borderSubtle),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: rec.poster.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: rec.poster,
                    width: 44,
                    height: 64,
                    fit: BoxFit.cover,
                  )
                : Container(width: 44, height: 64, color: Colors.white10),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(rec.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('${rec.year} • ${rec.director}', style: const TextStyle(fontSize: 11, color: Colors.white60)),
                if (rec.overview.isNotEmpty)
                  Text(rec.overview, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Colors.white38)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton.tonal(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.accentViolet.withOpacity(0.2),
              foregroundColor: AppTheme.accentViolet,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            onPressed: () {
              widget.onAddTitle(rec);
            },
            child: const Text('＋ Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
