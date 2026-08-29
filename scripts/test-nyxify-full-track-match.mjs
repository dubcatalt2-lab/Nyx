import assert from "node:assert/strict";
import { nyxifyArtistMatches, nyxifyDurationMatches, nyxifyOfficialArtistScore, nyxifyTrackTitleMatches } from "../server.js";

const cases = [
  {
    label: "Unicode artist",
    title: "Lilac",
    artist: "美波",
    duration: 302,
    correct: { title: "美波 - Lilac (Official Music Video)", author: "美波", authorVerified: true, durationSeconds: 305 },
    wrongArtist: { title: "Lilac (Official Music Video)", author: "Francesca Gagnon", authorVerified: true, durationSeconds: 304 },
    artistOnlyInTitle: { title: "美波 - Lilac (Official Music Video)", author: "Music Reuploads", authorVerified: false, durationSeconds: 304 },
    verifiedLabel: { title: "美波 - Lilac (Official Music Video)", author: "Fly-N Network", authorVerified: true, durationSeconds: 304 },
    wrongTitle: { title: "美波 - Kawaki wo Ameku (Official Music Video)", author: "美波", authorVerified: true, durationSeconds: 304 },
  },
  {
    label: "Latin artist",
    title: "Yellow",
    artist: "Coldplay",
    duration: 266,
    correct: { title: "Coldplay - Yellow (Official Video)", author: "Coldplay", authorVerified: true, durationSeconds: 266 },
    wrongArtist: { title: "Yellow (Official Video)", author: "Kevin Abstract", authorVerified: true, durationSeconds: 266 },
    artistOnlyInTitle: { title: "Coldplay - Yellow (Official Video)", author: "Music Reuploads", authorVerified: false, durationSeconds: 266 },
    verifiedLabel: { title: "Coldplay - Yellow (Official Video)", author: "Parlophone Records", authorVerified: true, durationSeconds: 266 },
    wrongTitle: { title: "Coldplay - Paradise (Official Video)", author: "Coldplay", authorVerified: true, durationSeconds: 266 },
  },
];

for (const sample of cases) {
  assert.equal(nyxifyTrackTitleMatches(sample.correct, sample.title), true, `${sample.label}: correct title was rejected`);
  assert.equal(nyxifyArtistMatches(sample.correct, sample.artist), true, `${sample.label}: correct artist was rejected`);
  assert.ok(nyxifyOfficialArtistScore(sample.correct, sample.artist) >= 80, `${sample.label}: correct official artist score was too low`);
  assert.equal(nyxifyDurationMatches(sample.correct, sample.duration), true, `${sample.label}: correct duration was rejected`);
  assert.equal(nyxifyArtistMatches(sample.wrongArtist, sample.artist), false, `${sample.label}: same-title wrong artist was accepted`);
  assert.equal(nyxifyOfficialArtistScore(sample.wrongArtist, sample.artist), 0, `${sample.label}: verified wrong artist received an official score`);
  assert.equal(nyxifyArtistMatches(sample.artistOnlyInTitle, sample.artist), true, `${sample.label}: explicit artist metadata from a label/reupload channel was rejected`);
  assert.equal(nyxifyArtistMatches(sample.verifiedLabel, sample.artist), true, `${sample.label}: a verified label upload with explicit artist metadata was rejected`);
  assert.equal(nyxifyTrackTitleMatches(sample.wrongTitle, sample.title), false, `${sample.label}: wrong title was accepted`);
}

assert.equal(nyxifyDurationMatches({ durationSeconds: 814 }, 302), false, "A much longer unrelated video was accepted");
console.log("Nyxify title, artist, Unicode, and duration matching regressions passed.");
