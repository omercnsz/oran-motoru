# Google Play üretim erişimi başvurusu – cevaplar

Kapalı test 14 günü doldurunca (en erken ~21 Ekim 2026) Kontrol paneli → "Üretim erişimine başvur" formunda kullanılır.
Testers Community'nin gönderdiği hazır cevaplar kullanılmadı: yapılmamış değişiklikler ve ulaşılmamış kullanıcılar yazıyordu.
Buradakiler sadece gerçekten yapılanları anlatır. **1.0.3 kapalı teste çıkmadan bu cevaplar gönderilmemeli** (8. cevap 1.0.3'ü anlatıyor).

Seçmeli sorular kullanıcıya ait: 2. (test kullanıcısı bulmak ne kadar kolaydı) ve 7. (ilk yıl beklenen yükleme).

---

**1. How did you recruit users for your closed test?**

I used a paid testing provider (Testers Community) to reach the required number of testers. I also tested the builds myself throughout the test.

**2. How easy was it to recruit testers for your app?**

(Kullanıcı seçer. Ücretli hizmetle 12 kişiye kolay ulaşıldı.)

**3. Describe the engagement you received from testers during your closed test.**

Testers installed the app and used it during the 14-day test on a range of devices and Android versions. The provider sent a written report: no crashes or functional bugs were found, and it included suggestions to improve onboarding, settings and the store listing. My own testing during the same period found a performance problem in the casino games, which I fixed in an update.

**4. Provide a summary of the feedback that you received from testers. Include how you collected the feedback.**

Feedback was collected through the provider's written test report and my own testing.
- Report: no crashes or bugs. Suggestions: a walkthrough for new users, a dark mode option, "rate" and "share" options, links to the privacy policy inside the app, and a more descriptive store listing.
- My own testing: the casino games stuttered when many sound effects played at once; the date header on the match list did not update after changing the language; the coupon bar text read badly in a few languages.

**5. Who is the intended audience for your app?**

Adults (18+) who follow football or enjoy casino-style games and want that experience without risking real money, including people who want to bet less.

**6. Describe how your app provides value to the users.**

Users pick real football matches and play casino games with play money only. The amount they would have staked goes into a piggy bank on their phone, and the app shows what would have happened with real money. Every game shows its real house edge next to the user's actual return, and a reality check shows time played and net result. There are no accounts, no purchases and no ads, and the data stays on the device.

**7. How many installs do you expect your app to have in your first year?**

(Kullanıcı seçer. Reklam ve tanıtım bütçesi olmadan gerçekçi bir aralık seçilmeli.)

**8. What changes did you make to your app based on what you learned during your closed test?**

- 1.0.2: sound effects now use a native low-latency player, which removed the stuttering in the games; rendering optimizations for roulette, Plinko and Crash; the match list date header now follows the selected language; corrected coupon bar wording in several languages.
- 1.0.3: a short walkthrough on first launch (it can be reopened from Settings); an appearance setting (same as phone, light or dark); an About section in Settings with the privacy policy, support page, "Rate" and "Share"; a rewritten, more descriptive store listing.

**9. How did you decide that your app is ready for production?**

No crashes were reported during the closed test, and every problem we found was fixed and checked again before the next update. The privacy policy, data safety form, content rating (simulated gambling, 18+) and store listing are complete and match how the app works.

**10. What did you do differently this time?**

This is the first time I am applying for production access for this app.
