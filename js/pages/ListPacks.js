import { fetchList } from "../content.js";
import { embed } from "../util.js";
import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

export default {
  components: {
    Spinner,
    LevelAuthors,
  },

  data: () => ({
    packs: [],
    list: [],
    selectedPackIndex: 0,
    selectedLevelIndex: 0,
    loading: true,
    error: null,
  }),

  methods: {
    normalize(name) {
      return (name || "").toLowerCase();
    },

    embed,
  },

  computed: {
    selectedPack() {
      return this.packs[this.selectedPackIndex] || null;
    },

    selectedLevelId() {
      return this.selectedPack?.levels?.[this.selectedLevelIndex] ?? null;
    },

    selectedLevel() {
      const found = this.list.find(
        ([lvl]) => lvl?.id === this.selectedLevelId
      );

      return found ? found[0] : null;
    },

    getOriginalRank() {
      return (levelId) => {
        const index = this.list.findIndex(
          ([lvl]) => lvl?.id === levelId
        );

        return index === -1 ? "?" : index + 1;
      };
    },

    packCompletions() {
      if (!this.selectedPack) return [];

      const userMap = new Map();
      const totalLevels = this.selectedPack.levels?.length || 0;

      (this.selectedPack.levels || []).forEach((levelId) => {
        const found = this.list.find(
          ([lvl]) => lvl?.id === levelId
        );

        const level = found ? found[0] : null;

        if (!level) return;

        const countedUsers = new Set();

        // Verifier
        if (level.verifier) {
          const verifier = level.verifier;
          const key = this.normalize(verifier);

          countedUsers.add(key);

          if (!userMap.has(key)) {
            userMap.set(key, {
              user: verifier,
              completions: 1,
              verifications: 1,
              totalLevels,
            });
          } else {
            const u = userMap.get(key);
            u.completions++;
            u.verifications = (u.verifications || 0) + 1;
          }
        }

        // Records
        if (Array.isArray(level.records)) {
          level.records.forEach((record) => {
            if (record?.percent !== 100) return;

            const username = record.user;
            const key = this.normalize(username);

            if (countedUsers.has(key)) return;

            countedUsers.add(key);

            if (!userMap.has(key)) {
              userMap.set(key, {
                user: username,
                completions: 1,
                verifications: 0,
              });
            } else {
              userMap.get(key).completions++;
            }
          });
        }
      });

      return Array.from(userMap.values()).sort(
        (a, b) => b.completions - a.completions
      );
    },
  },

  async mounted() {
    try {
      const normalize = (name) =>
        (name || "").toLowerCase();

      const hiddenUsers = ["none"];

      const processRecords = (records = []) => {
        return records.filter(
          (record) =>
            record?.user &&
            !hiddenUsers.includes(
              normalize(record.user)
            )
        );
      };

      const list = await fetchList();

      const response = await fetch("/data/_packs.json");

      if (!response.ok) {
        throw new Error(
          `Failed to load _packs.json (${response.status})`
        );
      }

      const packsData = await response.json();

      list.forEach((entry) => {
        const level = entry?.[0];

        if (
          level &&
          Array.isArray(level.records)
        ) {
          level.records = processRecords(
            level.records
          );
        }
      });

      this.list = list;

      this.packs = Array.isArray(packsData)
        ? packsData
        : packsData.packs || [];

    } catch (err) {
      console.error(
        "Failed to load pack page:",
        err
      );

      this.error =
        err?.message || "Unknown error";
    } finally {
      this.loading = false;
    }
  },

  template: `
    <main v-if="loading">
      <Spinner></Spinner>
    </main>

    <main v-else-if="error">
      <h2>Failed to load page</h2>
      <p>{{ error }}</p>
    </main>

    <main v-else class="page-list-packs">

      <div class="pack-selector">
        <button
          v-for="(pack, index) in packs"
          :key="pack.id"
          :class="{ active: index === selectedPackIndex }"
          @click="selectedPackIndex = index; selectedLevelIndex = 0"
          :style="{ '--color-background': pack.color }"
        >
          {{ pack.name }}
        </button>
      </div>

      <div class="list-container">
        <table
          class="list"
          v-if="selectedPack"
        >
          <tr
            v-for="(levelId, i) in selectedPack.levels"
            :key="levelId"
          >
            <td class="rank">
              <p class="type-label-lg">
                #{{ i + 1 }}
              </p>
            </td>

            <td
              class="level"
              :class="{ active: selectedLevelIndex === i }"
            >
              <button
                @click="selectedLevelIndex = i"
              >
                <span class="type-label-lg">
                  {{
                    list.find(
                      ([lvl]) =>
                        lvl?.id === levelId
                    )?.[0]?.name || "Error"
                  }}
                </span>
              </button>
            </td>
          </tr>
        </table>
      </div>

      <div
        class="level-container"
        v-if="selectedLevel"
      >
        <div class="level">

          <h1>
            {{ selectedLevel.name }}
          </h1>

          <LevelAuthors
            :author="selectedLevel.author"
            :creators="selectedLevel.creators"
            :verifier="selectedLevel.verifier"
          />

          <iframe
            class="video"
            id="videoframe"
            :src="embed(
              selectedLevel.showcase ||
              selectedLevel.verification
            )"
            frameborder="0"
          ></iframe>

          <ul class="stats">
            <li>
              <div class="type-title-sm">
                Points when completed
              </div>
              <p>
                {{ selectedPack.points || "N/A" }}
              </p>
            </li>

            <li>
              <div class="type-title-sm">
                ID
              </div>
              <p>
                {{ selectedLevel.id }}
              </p>
            </li>

            <li>
              <div class="type-title-sm">
                FPS
              </div>
              <p>
                {{ selectedLevel.fps || "Any" }}
              </p>
            </li>

            <li>
              <div class="type-title-sm">
                VERSION
              </div>
              <p>
                {{ selectedLevel.version || "Any" }}
              </p>
            </li>
          </ul>

          <div
            class="pack-completions"
            v-if="packCompletions.length"
          >
            <h2>
              Pack Progression
            </h2>

            <table class="list">
              <tr
                v-for="user in packCompletions"
                :key="user.user"
              >
                <td class="name">
                  {{ user.user }}

                  <span
                    v-if="
                      user.completions ===
                      selectedPack.levels.length
                    "
                    class="crown"
                  >
                    👑
                  </span>
                </td>

                <td class="completions">
                  <div class="progress-bar">
                    <div
                      class="progress"
                      :style="{
                        width:
                          (
                            user.completions /
                            selectedPack.levels.length *
                            100
                          ) + '%'
                      }"
                    ></div>
                  </div>

                  <span
                    class="progress-text"
                  >
                    {{
                      user.completions
                    }}
                    /
                    {{
                      selectedPack.levels.length
                    }}
                  </span>
                </td>
              </tr>
            </table>

          </div>

        </div>
      </div>

    </main>
  `,
};
