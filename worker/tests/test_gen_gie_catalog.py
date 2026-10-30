from scripts.gen_gie_catalog import active_terminals, terminal_slug


def test_terminal_slugs_are_ascii_and_short() -> None:
    assert terminal_slug("Wilhelmshaven LNG Terminal 1 (FSRU Hoegh Esperanza)") == "wilhelmshaven_1"
    assert terminal_slug("Świnoujście LNG Terminal") == "swinoujscie"
    assert terminal_slug("Rotterdam Gate Terminal") == "rotterdam_gate"


def test_post_brexit_virtual_historical_and_closed_entries_are_left_out() -> None:
    def facility(name: str, country: str, end: str | None = None) -> dict[str, str | None]:
        return {
            "name": name,
            "country": country,
            "company": "C",
            "eic": name[:3],
            "operational_end_date": end,
        }

    listing = [
        {
            "facilities": [
                facility("Sines LNG Terminal", "PT"),
                facility("South Hook LNG Terminal (Post-Brexit)", "GB*"),
                facility("South Hook LNG Terminal", "GB"),
                facility("TVB (Virtual balancing LNG tank)", "ES*"),
                facility("Panigaglia LNG Terminal (Historical data prior to 1 March 2025)", "IT"),
                facility("Le Havre LNG Terminal (FSRU Cape Ann)", "FR", "2025-01-01"),
            ]
        }
    ]
    assert [t["slug"] for t in active_terminals(listing)] == ["sines"]
