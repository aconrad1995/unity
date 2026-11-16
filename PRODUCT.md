# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript (Vite), mobile-first web app. The owner chose React and is installing Node.js themselves. Intended to be wrapped as an iOS/Android app later.

## Users

Ravers and festival-goers. The first version must win over **buyers hunting a look**: someone with an event coming up who wants a specific brand, size or style without paying full price. Sellers (people with lightly worn outfits to pass on) are the second audience; most users will be both over time.

## Product Purpose

A community app for the rave scene, started by Mary and her partner, who want to build something impactful in that community. It has three planned parts, built in this order:

1. **Resale marketplace** (first): buy and sell lightly worn rave outfits.
2. **Local events portal**: shows the biggest upcoming events near the user, based on the location they sign up with.
3. **Chat and DMs**: people connect to make content together or befriend each other at events.

## Positioning

Outfits, events and people in one place: the marketplace belongs to the scene rather than being a general thrift app with rave photos in it. The planned link between the three parts ("what are people wearing to the event I'm going to") is what a general resale app cannot offer.

## Operating Context

Used mostly on a phone. Buyers shop ahead of a specific event, so brand, size and style have to be fast to find.

## Capabilities and Constraints

- Search and filter by brand. Launch brand list: Badinka, Tasteful Girl, iHeartRaves, Freedom Rave Wear, Frammyland, Sassypants the Label, 1:11 the Label, Cocofields.
- Categories include bikini wear alongside rave outfits.
- Items are "lightly worn"; condition must be stated on every listing.
- Brand list: sellers pick from a broad list of rave brands or type any other. The shop's brand row shows only brands that have at least one listing.
- Revenue model (owner's decision): brands pay a flat monthly fee for a featured spot. A featured brand shows first in the brand row even with no listings, gets a banner with a link to its own store, and a "Buy it new" link on resale listings of its pieces. Every featured spot is labelled "Sponsored". Price, contract terms and contact address are undecided; no brand has signed up, and the only featured entry is a made-up placeholder ("Your Brand Here").
- Undecided: payments and payouts provider, shipping model, accounts/sign-in, hosting, event data source, moderation and age rules for DMs.
- Shared data: listings, public profiles (name, picture, "say hi about" picks) and one-to-one chats are stored by a small server that runs with the dev server (`server/api.mjs`, data in `.data/unity.json`). It works for people on the same computer or wifi (`npm run share`). It is not hosted on the internet yet; a hosting choice is the owner's.
- Identity: no sign-up or password. Each device holds a secret key; losing the browser data loses the account. Real sign-in is undecided.
- Chats: private between two people, started from a listing. Block and report exist; reports are saved in the data file and nobody is assigned to review them yet. Age rules and moderation policy are undecided.
- Private on the device only: sizes, style, favourite brands, saved outfits, learned taste.
- No real payments yet. Sample listings are labelled and cannot be messaged.

## Brand Commitments

- Working name: **Unity** (proposed by the owner, not yet cleared; "Unity" is also the name of a major game engine, so a trademark and app-store check is needed before committing).

## Evidence on Hand

- No real listings, photos, sellers, reviews, prices or sales figures exist yet. Sample listings in the build are synthetic and must be labeled as sample data. Do not invent testimonials, user counts or brand partnerships. The named brands are search filters only; there is no affiliation with them.

## Product Principles

1. It belongs to the scene: never a generic thrift app, never corporate or sterile.
2. Trust is visible: seller and item-condition signals on every listing, so it never feels sketchy or unsafe.
3. Finding one specific set is fast: brand, size and style are never buried.
4. Buyers first, then sellers, then the events and social layers on top.
